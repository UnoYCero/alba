import {openCredentials,sealCredentials} from './security.mjs';
const KEY = 'state-v1';
const empty = () => ({version:1,tenants:[],channels:[],messages:[],receipts:[],cases:[],usage:[]});
const readOnly = new Set(['orbita_status','orbita_operator_channel','orbita_case_for_message','orbita_find_case','orbita_require_lease']);
const rank = {accepted:0,sent:1,delivered:2,read:3};
const receiptState = status => status === 'failed' ? 'rejected' : status;
const advance = (current,next) => (rank[current] ?? -1) >= 2 && (rank[next] ?? -1) < rank[current] ? current : next;
const error = name => { throw new Error(name); };
const copy = value => structuredClone(value);
function operate(s,name,p,now,platformBudget) {
  const message = () => s.messages.find(m=>m.id===p.p_message_id) || error('MESSAGE_NOT_FOUND');
  const leased = () => {
    const m=message(), c=s.channels.find(c=>c.id===m.channelId);
    if (!c || c.owner!==p.p_owner || c.until<=now) error('LEASE_LOST');
    return [m,c];
  };
  const caseView = c => c ? {id:c.id,quote:copy(c.quote),submission:copy(c.submission)} : null;
  switch(name) {
    case 'orbita_create_tenant': {
      if (s.tenants.some(t=>t.id===p.p_id || t.slug===p.p_slug)) error('TENANT_EXISTS');
      s.tenants.push({id:p.p_id,slug:p.p_slug,name:p.p_name,paused:true,monthlyBudgetUsd:p.p_budget,inputPrice:.042});
      return {id:p.p_id,slug:p.p_slug,paused:true};
    }
    case 'orbita_create_channel': {
      if (!s.tenants.some(t=>t.id===p.p_tenant_id)) error('TENANT_NOT_FOUND');
      if (s.channels.some(c=>c.id===p.p_id || (c.appId===p.p_app_id && c.phoneNumberId===p.p_phone_id))) error('CHANNEL_EXISTS');
      const mode=p.p_mode || 'trial';
      if (!['trial','production'].includes(mode) || (mode==='production' ? p.p_allowed!==null : !Array.isArray(p.p_allowed) || !p.p_allowed.length)) error('CHANNEL_POLICY');
      s.channels.push({id:p.p_id,tenantId:p.p_tenant_id,appId:p.p_app_id,wabaId:p.p_waba_id,phoneNumberId:p.p_phone_id,
        connector:p.p_connector,credentials:p.p_credentials,mode,allowed:copy(p.p_allowed),enabled:false,credentialsReady:false,
        jevEnabled:true,credentialRevision:0,owner:null,until:null,error:null});
      return {id:p.p_id,tenantId:p.p_tenant_id,enabled:false};
    }
    case 'orbita_tenant_state': {
      const t=s.tenants.find(t=>t.id===p.p_id) || error('TENANT_NOT_FOUND'); t.paused=p.p_paused;
      return {id:t.id,paused:t.paused};
    }
    case 'orbita_operator_channel': {
      const c=s.channels.find(c=>c.id===p.p_id);
      return c ? {id:c.id,tenantId:c.tenantId,wabaId:c.wabaId,phoneNumberId:c.phoneNumberId,credentials:c.credentials} : null;
    }
    case 'orbita_activate_channel': {
      const c=s.channels.find(c=>c.id===p.p_id) || error('CHANNEL_NOT_FOUND');
      Object.assign(c,{credentials:p.p_credentials,enabled:true,credentialsReady:true,credentialRevision:c.credentialRevision+1,error:null});
      return {id:c.id,enabled:true};
    }
    case 'orbita_ingest': {
      if (!Array.isArray(p.p_events) || p.p_events.length>1000) error('INVALID_EVENTS');
      let added=0;
      for (const e of p.p_events) {
        const c=s.channels.find(c=>c.appId===p.p_app_id && c.wabaId===e.wabaId && c.phoneNumberId===e.phoneNumberId);
        if (!c) continue;
        if (e.kind==='inbound') {
          if (!c.enabled || (c.mode==='trial' && !c.allowed.includes(e.from)) || s.messages.some(m=>m.channelId===c.id && m.providerId===e.id)) continue;
          s.messages.push({id:crypto.randomUUID(),tenantId:c.tenantId,channelId:c.id,providerId:e.id,sender:e.from,name:e.name,body:e.body,
            mediaId:e.mediaId,type:e.type,receivedAt:e.receivedAt,createdAt:now,decision:null,reply:null,needsHuman:false,
            delivery:'pending',outboundId:null,attempts:0,next:now,error:null}); added++;
        } else if (e.kind==='receipt' && ['sent','delivered','read','failed'].includes(e.status)) {
          let r=s.receipts.find(r=>r.channelId===c.id && r.providerId===e.id);
          if (!r) { r={channelId:c.id,providerId:e.id,status:e.status}; s.receipts.push(r); }
          Object.assign(r,{status:advance(r.status,e.status),sender:e.from,errorCode:e.errorCode,receivedAt:now});
          for (const m of s.messages.filter(m=>m.channelId===c.id && m.outboundId===e.id && m.sender===e.from)) m.delivery=advance(m.delivery,receiptState(e.status));
        }
      }
      return {added};
    }
    case 'orbita_claim': {
      for (const m of s.messages.filter(m=>m.delivery==='sending')) {
        const c=s.channels.find(c=>c.id===m.channelId);
        if (c.until!==null && c.until<now) Object.assign(m,{delivery:'unknown',error:'LEASE_EXPIRED_DURING_SEND',needsHuman:true});
      }
      const due=s.messages.filter(m=>m.delivery==='pending' && m.attempts<5 && m.next<=now).sort((a,b)=>a.createdAt-b.createdAt || a.id.localeCompare(b.id));
      for (const m of due) {
        const c=s.channels.find(c=>c.id===m.channelId), t=s.tenants.find(t=>t.id===m.tenantId);
        if (!c.enabled || !c.credentialsReady || t.paused || (c.until!==null && c.until>=now)) continue;
        c.owner=p.p_owner; c.until=now+120000; m.attempts++;
        return {id:m.id,tenantId:t.id,tenantName:t.name,channelId:c.id,phoneNumberId:c.phoneNumberId,connector:c.connector,
          credentials:c.credentials,credentialRevision:c.credentialRevision,jevEnabled:c.jevEnabled,decision:copy(m.decision),reply:m.reply,
          message:{id:m.providerId,from:m.sender,name:m.name,body:m.body,mediaId:m.mediaId,receivedAt:m.receivedAt}};
      }
      return null;
    }
    case 'orbita_require_lease': leased(); return null;
    case 'orbita_reserve_usage': {
      const [m]=leased(), t=s.tenants.find(t=>t.id===m.tenantId);
      if (!Number.isSafeInteger(p.p_tokens) || p.p_tokens<1 || p.p_tokens>20000 || t.paused || s.usage.some(u=>u.messageId===m.id)) return false;
      const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit'}).format(new Date(now));
      const amount=Math.ceil(p.p_tokens*t.inputPrice*100)/1e8;
      const usage=s.usage.filter(u=>u.month===month);
      const total=usage.reduce((sum,u)=>sum+u.amount,0), used=usage.filter(u=>u.tenantId===t.id).reduce((sum,u)=>sum+u.amount,0);
      if ((t.monthlyBudgetUsd!==null && used+amount>t.monthlyBudgetUsd) || (platformBudget!==null && total+amount>platformBudget)) return false;
      s.usage.push({messageId:m.id,tenantId:t.id,month,amount,verified:false}); return true;
    }
    case 'orbita_save_decision': {
      const [m]=leased(); if (m.decision===null) m.decision=copy(p.p_decision);
      const u=s.usage.find(u=>u.messageId===m.id), t=s.tenants.find(t=>t.id===m.tenantId), tokens=p.p_decision?.usage?.inputTokens;
      if (u && Number.isSafeInteger(tokens) && tokens>=0) Object.assign(u,{inputTokens:tokens,outputTokens:p.p_decision.usage.outputTokens,
        amount:Math.ceil(tokens*t.inputPrice*100)/1e8,verified:true}); return null;
    }
    case 'orbita_handoff': leased()[0].needsHuman=true; return null;
    case 'orbita_prepare_reply': {
      const [m]=leased(); if (typeof p.p_reply!=='string' || !p.p_reply.length || p.p_reply.length>4000) error('INVALID_REPLY');
      if (m.delivery==='pending') m.reply=p.p_reply; return null;
    }
    case 'orbita_mark_sending': {
      const [m]=leased(); if (m.delivery!=='pending' || !m.reply) error('SEND_NOT_PREPARED');
      m.delivery='sending'; return null;
    }
    case 'orbita_finish': {
      const [m,c]=leased(), d=p.p_delivery;
      if (!['accepted','rejected','unknown','expired'].includes(d.status)) error('INVALID_DELIVERY');
      const r=s.receipts.find(r=>r.channelId===c.id && r.providerId===d.messageId && r.sender===m.sender);
      const status=r ? receiptState(r.status) : d.status;
      Object.assign(m,{delivery:status,outboundId:d.messageId || null,error:d.error || null,needsHuman:m.needsHuman || ['rejected','unknown','expired'].includes(status)});
      if ((d.code===190 || d.error==='META_CREDENTIAL_EXPIRED') && c.credentialRevision===d.credentialRevision) Object.assign(c,{credentialsReady:false,error:'META_CREDENTIAL_INVALID'});
      c.owner=null; c.until=null; return null;
    }
    case 'orbita_fail_job': {
      const [m,c]=leased();
      Object.assign(m,{delivery:p.p_sending?'unknown':'pending',next:now+Math.min(1800000,30000*2**m.attempts),
        error:'PROCESSING_FAILED',needsHuman:m.needsHuman || p.p_sending || m.attempts>=5});
      c.owner=null; c.until=null; return null;
    }
    case 'orbita_case_for_message': {
      const [m]=leased(); return caseView(s.cases.find(c=>c.messageId===m.id));
    }
    case 'orbita_save_case': {
      const [m]=leased(); let c=s.cases.find(c=>c.messageId===m.id);
      if (!c) {
        if (s.cases.some(c=>c.id===p.p_case_id)) error('CASE_EXISTS');
        c={id:p.p_case_id,tenantId:m.tenantId,channelId:m.channelId,sender:m.sender,messageId:m.id,quote:copy(p.p_quote),submission:null}; s.cases.push(c);
      }
      return caseView(c);
    }
    case 'orbita_find_case': {
      const [m]=leased(); return caseView(s.cases.find(c=>c.id===p.p_case_id && c.tenantId===m.tenantId && c.channelId===m.channelId && c.sender===m.sender));
    }
    case 'orbita_submit_case': {
      const [m]=leased(), c=s.cases.find(c=>c.id===p.p_case_id && c.tenantId===m.tenantId && c.channelId===m.channelId && c.sender===m.sender);
      if (!c) error('CASE_NOT_OWNED'); c.submission=copy(p.p_submission); return null;
    }
    case 'orbita_status': {
      const messages={}; for (const m of s.messages) messages[m.delivery]=(messages[m.delivery] || 0)+1;
      return {tenants:s.tenants.map(({id,slug,name,paused,monthlyBudgetUsd})=>({id,slug,name,paused,monthlyBudgetUsd})),
        channels:s.channels.map(({id,tenantId,enabled,credentialsReady,error})=>({id,tenantId,enabled,credentialsReady,error})),messages};
    }
    default: error('OPERATION_NOT_ALLOWED');
  }
}
// Small-volume deployment: one encrypted document makes all state transitions atomic.
// No provider calls happen inside this retry loop. Do not replace CAS with last-write-wins.
export function createBlobState(store,env,{clock=Date.now,maxBytes=8*1024*1024,retries=20}={}) {
  if (!/^[a-f0-9]{64}$/i.test(env.ORBITA_CREDENTIAL_KEY || '')) error('CREDENTIAL_KEY_MISSING');
  const configured=env.ORBITA_MONTHLY_BUDGET_USD;
  const platformBudget=configured===undefined || configured==='' ? null : Number(configured);
  if (platformBudget!==null && (!Number.isFinite(platformBudget) || platformBudget<0)) error('BUDGET_INVALID');
  return {async exportSnapshot() {
    const current=await store.getWithMetadata(KEY,{type:'text',consistency:'strong'});
    if (!current) error('SNAPSHOT_NOT_FOUND');
    return {ciphertext:current.data,etag:current.etag};
  },async rpc(name,p={}) {
    if (!/^orbita_[a-z_]+$/.test(name)) error('OPERATION_NOT_ALLOWED');
    for (let attempt=0;attempt<retries;attempt++) {
      const current=await store.getWithMetadata(KEY,{type:'text',consistency:'strong'});
      const state=current ? await openCredentials(current.data,env.ORBITA_CREDENTIAL_KEY,'orbita-platform','netlify-state-v1') : empty();
      if (state.version!==1 || !['tenants','channels','messages','receipts','cases','usage'].every(k=>Array.isArray(state[k]))) error('STATE_INVALID');
      const before=JSON.stringify(state), result=operate(state,name,p,clock(),platformBudget);
      const after=JSON.stringify(state);
      if (readOnly.has(name) || before===after) return result;
      if (new TextEncoder().encode(after).length>maxBytes) error('STATE_CAPACITY_REACHED');
      const sealed=await sealCredentials(state,env.ORBITA_CREDENTIAL_KEY,'orbita-platform','netlify-state-v1');
      const write=await store.set(KEY,sealed,current ? {onlyIfMatch:current.etag} : {onlyIfNew:true});
      // Older SDKs can misreport non-412 failures as modified with an empty ETag.
      // Never acknowledge or send unless the conditional write has a valid receipt.
      if (write.modified) {
        if (typeof write.etag!=='string' || !write.etag) error('STATE_WRITE_NOT_CONFIRMED');
        return result;
      }
      await new Promise(resolve=>setTimeout(resolve,Math.min(100,5*(attempt+1))+Math.random()*10));
    }
    error('STATE_CONTENTION');
  }};
}
