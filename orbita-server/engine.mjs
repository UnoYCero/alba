import {openCredentials,canonicalPhone} from './security.mjs';
import {classificationConfig} from './ai.mjs';
import {createSankalpaConnector,prepareSankalpaReply} from './sankalpa.mjs';
import {prepareCommerceReply,createCommerceConnector,commerceStoreFor} from './commerce.mjs';
import {salesAllowedForJob,prepareSalesReply} from './sales.mjs';
import {createSalesConnector} from './sales-connector.mjs';
import {outboundReply} from './reply-media.mjs';
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
        context:{message_id:job.message.id},...outboundReply(reply)}),signal:AbortSignal.timeout(10000)});
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
    if (job.coexistence && !await database.rpc('orbita_coexistence_check',{p_message_id:job.id,p_owner:owner})) {
      await database.rpc('orbita_coexistence_skip',{p_message_id:job.id,p_owner:owner});
      return {processed:1,status:'held'};
    }
    if (!job.coexistence && env.ORBITA_PORTAL_ENABLED==='true') {
      const context=await database.rpc('orbita_commerce_context',{p_message_id:job.id,p_owner:owner});
      if(context.held){await database.rpc('orbita_commerce_skip',{p_message_id:job.id,p_owner:owner});return {processed:1,status:'held'};}
    }
    const credentials = await openCredentials(job.credentials,env.ORBITA_CREDENTIAL_KEY,job.tenantId,job.channelId);
    let decision = job.decision;
    let reply=job.reply;
    if(!reply&&job.connector==='sankalpa-guided-v1'&&await salesAllowedForJob(env,job,database)){
      const result=await prepareSalesReply(job,{env,database,owner,fetcher,connector:createSalesConnector(credentials,fetcher),store:commerceStoreFor(database,env)});
      if(result?.held)return {processed:1,status:'held'};reply=result?.reply;
    }
    if (!reply && !decision && !job.message.mediaId && job.message.body && job.jevEnabled) {
      const ai=classificationConfig(env);
      const estimateTokens=ai.estimate(job.message.body,job.tenantName);
      const request=ai.reserve(job.id,owner,estimateTokens);
      const reservation=await database.rpc(request.name,request.parameters);
      if (reservation) {
        try { decision=await ai.classify(job.message.body,job.tenantName,fetcher); }
        catch { decision={status:'unavailable',provider:ai.provider,model:ai.model,routable:false}; }
        await database.rpc('orbita_save_decision',{p_message_id:job.id,p_owner:owner,p_decision:decision});
      } else decision={status:'budget_blocked',provider:ai.provider,model:ai.model,routable:false};
    }
    if (!reply) {
      if (job.connector === 'sankalpa-guided-v1') {
        if (env.ORBITA_COMMERCE_ENABLED==='true') {
          const result=await prepareCommerceReply(job,decision,createCommerceConnector(credentials,fetcher),database,owner,
            {store:commerceStoreFor(database,env)});
          if(result?.held)return {processed:1,status:'held'};
          reply=result?.reply;
        }
        if(!reply)reply=await prepareSankalpaReply(job,decision,createSankalpaConnector(credentials,fetcher),database,owner);
      }
      else if (job.connector === 'human-review-v1') {
        await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});
        reply = 'Recibimos tu mensaje. Un responsable del negocio debe revisar esta conversación.';
      } else throw new Error('CONNECTOR_UNSUPPORTED');
    }
    if(!job.reply)await database.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:reply});
    // Persist the uncertain state before the irreversible provider call.
    if (job.coexistence) {
      if (!await database.rpc('orbita_coexistence_begin_send',{p_message_id:job.id,p_owner:owner})) return {processed:1,status:'held'};
    } else if(env.ORBITA_COMMERCE_ENABLED==='true'||env.ORBITA_PORTAL_ENABLED==='true') {
      if(!await database.rpc('orbita_commerce_begin_send',{p_message_id:job.id,p_owner:owner}))return {processed:1,status:'held'};
    } else await database.rpc('orbita_mark_sending',{p_message_id:job.id,p_owner:owner});
    sending = true;
    const delivery = await sendReply(job,reply,credentials,fetcher);
    await database.rpc('orbita_finish',{p_message_id:job.id,p_owner:owner,p_delivery:{...delivery,credentialRevision:job.credentialRevision}});
    return {processed:1,status:delivery.status};
  } catch {
    try { await database.rpc('orbita_fail_job',{p_message_id:job.id,p_owner:owner,p_sending:sending}); } catch { /* The lease recovery handles interrupted persistence. */ }
    return {processed:1,status:sending?'unknown':'retry'};
  }
}
