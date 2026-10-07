import {openCredentials,canonicalPhone} from './security.mjs';
import {classify,intentRequest,MODEL} from './jev.mjs';
import {createSankalpaConnector,prepareSankalpaReply} from './sankalpa.mjs';
export async function sendReply(job, reply, credentials, fetcher = fetch) {
  const age = Date.now()-Date.parse(job.message.receivedAt);
  if (!Number.isFinite(age) || age < -300000 || age >= 24*60*60*1000) return {status:'expired',error:'REPLY_WINDOW_CLOSED'};
  if (!/^\d{6,30}$/.test(job.phoneNumberId) || !/^\d{10,15}$/.test(canonicalPhone(job.message.from))) throw new Error('SEND_CONTEXT_INVALID');
  if (!credentials.metaAccessToken || (credentials.tokenExpiresAt && credentials.tokenExpiresAt*1000 <= Date.now())) return {status:'rejected',error:'META_CREDENTIAL_EXPIRED'};
  let response;
  try {
    response = await fetcher(`https://graph.facebook.com/v25.0/${job.phoneNumberId}/messages`, {method:'POST',redirect:'error',
      headers:{Authorization:`Bearer ${credentials.metaAccessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:canonicalPhone(job.message.from),
        context:{message_id:job.message.id},type:'text',text:{preview_url:false,body:reply.slice(0,4000)}}),signal:AbortSignal.timeout(10000)});
    const result = await response.json();
    if (!response.ok) return {status:response.status >= 500?'unknown':'rejected',error:'META_SEND_FAILED',code:Number.isSafeInteger(result?.error?.code)?result.error.code:null};
    const messageId = result?.messages?.[0]?.id;
    return typeof messageId === 'string' && messageId ? {status:'accepted',messageId} : {status:'unknown',error:'META_RESULT_UNCERTAIN'};
  } catch { return {status:'unknown',error:'META_DELIVERY_UNCERTAIN'}; }
}
export async function runOneJob(env, database, {fetcher=fetch}={}) {
  const owner = crypto.randomUUID();
  const job = await database.rpc('orbita_claim',{p_owner:owner});
  if (!job) return {processed:0};
  let sending = false;
  try {
    const credentials = await openCredentials(job.credentials,env.ORBITA_CREDENTIAL_KEY,job.tenantId,job.channelId);
    let decision = job.decision;
    if (!job.reply && !decision && !job.message.mediaId && job.message.body && job.jevEnabled) {
      const estimateTokens = new TextEncoder().encode(JSON.stringify(intentRequest(job.message.body,job.tenantName))).length+512;
      const reservation = await database.rpc('orbita_reserve_usage',{p_message_id:job.id,p_owner:owner,p_tokens:estimateTokens});
      if (reservation) {
        try { decision = await classify(job.message.body,job.tenantName,env.ORBITA_TYPESAFE_API_KEY,fetcher); }
        catch { decision = {status:'unavailable',model:MODEL,routable:false}; }
        await database.rpc('orbita_save_decision',{p_message_id:job.id,p_owner:owner,p_decision:decision});
      } else decision = {status:'budget_blocked',model:MODEL,routable:false};
    }
    let reply = job.reply;
    if (!reply) {
      if (job.connector === 'sankalpa-guided-v1') reply = await prepareSankalpaReply(job,decision,createSankalpaConnector(credentials,fetcher),database,owner);
      else if (job.connector === 'human-review-v1') {
        await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});
        reply = 'Recibimos tu mensaje. Un responsable del negocio debe revisar esta conversación.';
      } else throw new Error('CONNECTOR_UNSUPPORTED');
      await database.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:reply});
    }
    // Persist the uncertain state before the irreversible provider call.
    await database.rpc('orbita_mark_sending',{p_message_id:job.id,p_owner:owner}); sending = true;
    const delivery = await sendReply(job,reply,credentials,fetcher);
    await database.rpc('orbita_finish',{p_message_id:job.id,p_owner:owner,p_delivery:{...delivery,credentialRevision:job.credentialRevision}});
    return {processed:1,status:delivery.status};
  } catch {
    try { await database.rpc('orbita_fail_job',{p_message_id:job.id,p_owner:owner,p_sending:sending}); } catch { /* The lease recovery handles interrupted persistence. */ }
    return {processed:1,status:sending?'unknown':'retry'};
  }
}
