import {createDatabase} from './database.mjs';
import {receiveWebhook} from './webhook.mjs';
import {equalSecret,boundedBody,sealCredentials,openCredentials,canonicalPhone} from './security.mjs';
import {runOneJob} from './engine.mjs';
import {verifyDurableMetaCredential} from './meta-credentials.mjs';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const json = (data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function createHandler({env,database,fetcher=fetch,waitUntil,scheduleJob}={}) {
  const privateAccessReady = /^[A-Za-z0-9_-]{32,256}$/.test(env.ORBITA_OPERATOR_TOKEN || '') &&
    /^[A-Za-z0-9_-]{32,256}$/.test(env.ORBITA_WORKER_TOKEN || '') && env.ORBITA_OPERATOR_TOKEN !== env.ORBITA_WORKER_TOKEN;
  const backgroundJob = db => runOneJob(env,db,{fetcher}).catch(()=>console.error('ORBITA_WORKER_FAILED'));
  return async request => {
    try {
      const path = new URL(request.url).pathname.replace(/^\/functions\/v1\/orbita-platform/,'');
      if (path === '/health' && request.method === 'GET') return json({service:'orbita',version:'0.1.0',enabled:env.ORBITA_ENABLED==='true'});
      const db = database || createDatabase(env,fetcher);
      if (path === '/webhooks/whatsapp') {
        if (env.ORBITA_ENABLED !== 'true') return json({error:'SERVICE_PAUSED'},503);
        const response = await receiveWebhook(request,env,db);
        if (response.ok && request.method === 'POST' && waitUntil) waitUntil(backgroundJob(db));
        if (response.ok && request.method === 'POST' && scheduleJob) {
          // The message is already persisted. A failed trigger is recovered by the scheduler.
          try { await scheduleJob(); } catch { console.error('ORBITA_WORKER_TRIGGER_FAILED'); }
        }
        return response;
      }
      if (path === '/jobs/run' && request.method === 'POST') {
        if (!privateAccessReady) return json({error:'PRIVATE_ACCESS_NOT_CONFIGURED'},503);
        if (!await equalSecret(request.headers.get('authorization'),env.ORBITA_WORKER_TOKEN && `Bearer ${env.ORBITA_WORKER_TOKEN}`)) return json({error:'FORBIDDEN'},403);
        if (env.ORBITA_ENABLED !== 'true') return json({processed:0,paused:true});
        if (scheduleJob) { await scheduleJob(); return json({scheduled:true},202); }
        if (waitUntil) {
          waitUntil(backgroundJob(db));
          return json({scheduled:true},202);
        }
        return json(await runOneJob(env,db,{fetcher}));
      }
      if (path.startsWith('/operator/')) {
        if (!privateAccessReady) return json({error:'PRIVATE_ACCESS_NOT_CONFIGURED'},503);
        if (!await equalSecret(request.headers.get('authorization'),env.ORBITA_OPERATOR_TOKEN && `Bearer ${env.ORBITA_OPERATOR_TOKEN}`)) return json({error:'FORBIDDEN'},403);
        if (path === '/operator/status' && request.method === 'GET') return json(await db.rpc('orbita_status',{}));
        if (request.method !== 'POST') return json({error:'METHOD_NOT_ALLOWED'},405);
        let data;
        try { data = JSON.parse(new TextDecoder().decode(await boundedBody(request,16384))); }
        catch(error) { return json({error:error.status===413?'BODY_LIMIT':'INVALID_JSON'},error.status===413?413:400); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return json({error:'INVALID_JSON'},400);
        const tenantState = path.match(/^\/operator\/tenants\/([a-f0-9-]{36})\/state$/i);
        if (tenantState && UUID.test(tenantState[1]) && typeof data.paused === 'boolean') {
          return json(await db.rpc('orbita_tenant_state',{p_id:tenantState[1],p_paused:data.paused}));
        }
        const activate = path.match(/^\/operator\/channels\/([a-f0-9-]{36})\/activate$/i);
        if (activate && UUID.test(activate[1]) && data.verify === true) {
          const channel = await db.rpc('orbita_operator_channel',{p_id:activate[1]});
          if (!channel) return json({error:'CHANNEL_NOT_FOUND'},404);
          const previous = await openCredentials(channel.credentials,env.ORBITA_CREDENTIAL_KEY,channel.tenantId,channel.id);
          const credentials = await verifyDurableMetaCredential({...previous,...(typeof data.metaAccessToken==='string'?{metaAccessToken:data.metaAccessToken}:{})},channel,env,fetcher);
          const ciphertext = await sealCredentials(credentials,env.ORBITA_CREDENTIAL_KEY,channel.tenantId,channel.id);
          return json(await db.rpc('orbita_activate_channel',{p_id:channel.id,p_credentials:ciphertext}));
        }
        if (path === '/operator/tenants') {
          if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(data.slug || '') || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80 ||
            (data.budgetUsd !== null && (!Number.isFinite(data.budgetUsd) || data.budgetUsd < 0 || data.budgetUsd > 1000000))) return json({error:'INVALID_TENANT'},400);
          return json(await db.rpc('orbita_create_tenant',{p_id:crypto.randomUUID(),p_slug:data.slug,p_name:data.name.trim(),p_budget:data.budgetUsd}),201);
        }
        if (path === '/operator/channels') {
          const mode = data.mode || 'trial';
          const senderPolicyValid = mode === 'production' ? data.allowedSenders === null : mode === 'trial' &&
            Array.isArray(data.allowedSenders) && data.allowedSenders.length > 0 && data.allowedSenders.length <= 100 &&
            data.allowedSenders.every(value=>typeof value === 'string' && /^\d{10,15}$/.test(canonicalPhone(value)));
          if (!UUID.test(data.tenantId || '') || !/^\d{6,30}$/.test(data.phoneNumberId || '') || !/^\d{6,30}$/.test(data.wabaId || '') ||
            !['sankalpa-guided-v1','human-review-v1'].includes(data.connector) || typeof data.credentials?.metaAccessToken !== 'string' ||
            !senderPolicyValid) return json({error:'INVALID_CHANNEL'},400);
          const id = crypto.randomUUID();
          const ciphertext = await sealCredentials(data.credentials,env.ORBITA_CREDENTIAL_KEY,data.tenantId,id);
          // Registration stays disabled until the operator verifies the asset and durable token.
          return json(await db.rpc('orbita_create_channel',{p_id:id,p_tenant_id:data.tenantId,p_app_id:env.ORBITA_META_APP_ID,
            p_waba_id:data.wabaId,p_phone_id:data.phoneNumberId,p_connector:data.connector,p_credentials:ciphertext,
            p_allowed:mode==='production'?null:data.allowedSenders.map(canonicalPhone),p_mode:mode}),201);
        }
      }
      return json({error:'NOT_FOUND'},404);
    } catch(error) { return json({error:error.status===413?'BODY_LIMIT':'SERVICE_UNAVAILABLE'},error.status===413?413:503); }
  };
}
