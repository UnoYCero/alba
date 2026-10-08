import {createDatabase} from './database.mjs';
import {openCredentials,sealCredentials,canonicalPhone} from './security.mjs';
const inboundContext=(app,phone,id)=>`${app}:${phone}:${id}`;
const timestamp=value=>new Date(value).toISOString();
// Database roles never receive the master key. Body/name/phone/media and replies
// are encrypted by the trusted worker; equality indexes use domain-separated HMAC.
export function createEncryptedDatabase(env,fetcher=fetch,transport) {
  if (!/^[a-f0-9]{64}$/i.test(env.ORBITA_CREDENTIAL_KEY || '') || !/^\d{6,30}$/.test(env.ORBITA_META_APP_ID || '')) throw new Error('ENCRYPTION_NOT_CONFIGURED');
  const db=transport || createDatabase(env,fetcher), master=env.ORBITA_CREDENTIAL_KEY, app=env.ORBITA_META_APP_ID;
  const encoder=new TextEncoder();
  const indexKey=crypto.subtle.importKey('raw',Uint8Array.from(master.match(/../g),v=>parseInt(v,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  async function phoneIndex(value) {
    const phone=canonicalPhone(value);if (!/^\d{10,15}$/.test(phone)) throw new Error('PHONE_INDEX_INVALID');
    const signed=await crypto.subtle.sign('HMAC',await indexKey,encoder.encode(`orbita-phone-index-v1:${app}:${phone}`));
    return 'h1_'+Array.from(new Uint8Array(signed),v=>v.toString(16).padStart(2,'0')).join('');
  }
  async function encryptInbound(message,phone) {
    return sealCredentials({id:message.id,from:canonicalPhone(message.from),name:message.name || '',body:message.body || '',
      mediaId:message.mediaId || null,receivedAt:message.receivedAt},master,'orbita-inbound-v1',inboundContext(app,phone,message.id));
  }
  async function encryptReply(reply,id) {
    if (typeof reply!=='string' || !reply.length || reply.length>4000) throw new Error('INVALID_REPLY');
    return sealCredentials({reply},master,'orbita-reply-v1',id);
  }
  async function rpc(name,parameters) {
    let p=structuredClone(parameters);
    if (name==='orbita_create_channel' && p.p_allowed!==null) p.p_allowed=await Promise.all(p.p_allowed.map(phoneIndex));
    if (['orbita_configure_coexistence','orbita_conversation_state'].includes(name)) {
      const field=name==='orbita_configure_coexistence'?'p_business_phone':'p_sender';
      p[field]=await phoneIndex(p[field]);
    }
    if (name==='orbita_ingest' || name==='orbita_ingest_coexistence') {
      if (p.p_app_id!==app || !Array.isArray(p.p_events) || p.p_events.length>1000) throw new Error('INVALID_EVENTS');
      p.p_events=await Promise.all(p.p_events.map(async e=>{
        const indexed={...e,from:e.from===null?null:await phoneIndex(e.from)};
        if (e.kind==='inbound' || e.kind==='manual') Object.assign(indexed,{name:'',mediaId:null,body:await encryptInbound(e,e.phoneNumberId)});
        return indexed;
      }));
    }
    if (name==='orbita_prepare_reply') p.p_reply=await encryptReply(p.p_reply,p.p_message_id);
    if (name==='orbita_save_case') p.p_quote=JSON.parse(await sealCredentials(p.p_quote,master,'orbita-quote-v1',p.p_case_id));
    if (name==='orbita_submit_case') p.p_submission=JSON.parse(await sealCredentials(p.p_submission,master,'orbita-submission-v1',p.p_case_id));
    const result=await db.rpc(name,p);
    if (name==='orbita_claim' && result) {
      const message=await openCredentials(result.message.body,master,'orbita-inbound-v1',inboundContext(app,result.phoneNumberId,result.message.id));
      if (message.id!==result.message.id || await phoneIndex(message.from)!==result.message.from ||
        Date.parse(message.receivedAt)!==Date.parse(result.message.receivedAt)) throw new Error('MESSAGE_CONTEXT_INVALID');
      result.message=message;
      if (result.reply) result.reply=(await openCredentials(result.reply,master,'orbita-reply-v1',result.id)).reply;
    }
    if (['orbita_case_for_message','orbita_find_case','orbita_save_case'].includes(name) && result) {
      result.quote=await openCredentials(JSON.stringify(result.quote),master,'orbita-quote-v1',result.id);
      if (result.submission!==null) result.submission=await openCredentials(JSON.stringify(result.submission),master,'orbita-submission-v1',result.id);
    }
    return result;
  }
  async function prepareSnapshot(snapshot) {
    if (snapshot?.version!==1 || !['tenants','channels','messages','receipts','cases','usage'].every(k=>Array.isArray(snapshot[k]))) throw new Error('SNAPSHOT_INVALID');
    const channelMap=new Map(snapshot.channels.map(c=>[c.id,c]));
    const tenants=snapshot.tenants.map(t=>({id:t.id,slug:t.slug,name:t.name,paused:t.paused,monthly_budget_usd:t.monthlyBudgetUsd,input_usd_per_million:t.inputPrice}));
    const channels=await Promise.all(snapshot.channels.map(async c=>{
      if (c.appId!==app || !snapshot.tenants.some(t=>t.id===c.tenantId) || c.owner || c.until) throw new Error('SNAPSHOT_CHANNEL_NOT_IDLE');
      await openCredentials(c.credentials,master,c.tenantId,c.id);
      return {id:c.id,tenant_id:c.tenantId,app_id:c.appId,waba_id:c.wabaId,phone_number_id:c.phoneNumberId,connector:c.connector,
        credentials:c.credentials,mode:c.mode,allowed_senders:c.allowed===null?null:await Promise.all(c.allowed.map(phoneIndex)),
        enabled:c.enabled,credentials_ready:c.credentialsReady,jev_enabled:c.jevEnabled,credential_revision:c.credentialRevision,last_error:c.error};
    }));
    const messages=await Promise.all(snapshot.messages.map(async m=>{
      const c=channelMap.get(m.channelId);if (!c || c.tenantId!==m.tenantId || m.delivery==='sending') throw new Error('SNAPSHOT_MESSAGE_INVALID');
      const body=await encryptInbound({id:m.providerId,from:m.sender,name:m.name,body:m.body,mediaId:m.mediaId,receivedAt:m.receivedAt},c.phoneNumberId);
      return {id:m.id,tenant_id:m.tenantId,channel_id:m.channelId,provider_id:m.providerId,sender:await phoneIndex(m.sender),customer_name:'',body,
        media_id:null,message_type:m.type,received_at:m.receivedAt,created_at:timestamp(m.createdAt),decision:m.decision,
        reply:m.reply===null?null:await encryptReply(m.reply,m.id),needs_human:m.needsHuman,delivery:m.delivery,outbound_id:m.outboundId,
        attempts:m.attempts,next_attempt_at:timestamp(m.next),last_error:m.error};
    }));
    const receipts=await Promise.all(snapshot.receipts.map(async r=>({channel_id:r.channelId,provider_id:r.providerId,sender:await phoneIndex(r.sender),status:r.status,error_code:r.errorCode ?? null,received_at:timestamp(r.receivedAt)})));
    const cases=await Promise.all(snapshot.cases.map(async c=>({id:c.id,tenant_id:c.tenantId,channel_id:c.channelId,sender:await phoneIndex(c.sender),source_message_id:c.messageId,
      quote:JSON.parse(await sealCredentials(c.quote,master,'orbita-quote-v1',c.id)),
      submission:c.submission===null?null:JSON.parse(await sealCredentials(c.submission,master,'orbita-submission-v1',c.id))})));
    const usage=snapshot.usage.map(u=>({message_id:u.messageId,tenant_id:u.tenantId,month:u.month,model:'jev-1.13.0',input_tokens:u.inputTokens ?? null,output_tokens:u.outputTokens ?? null,estimated_usd:u.amount,verified:u.verified}));
    return {version:1,tenants,channels,messages,receipts,cases,usage};
  }
  return {rpc,prepareSnapshot,phoneIndex};
}
