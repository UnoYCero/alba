import {createBlobState} from './blob-state.mjs';
import {createHandler} from './handler.mjs';
import {createEncryptedDatabase} from './encrypted-database.mjs';
import {equalSecret} from './security.mjs';
import {deploymentTarget} from './deployment.mjs';
const available=(context,env)=>{const target=deploymentTarget(env);return !!target&&context?.site?.id===target.siteId&&context?.account?.id===target.teamId&&context?.deploy?.context==='production'&&context?.deploy?.published===true;};
export function isPublishedProduction(context,env={}) { return available(context,env); }
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function checkedStorageFetch(fetcher=fetch) {
  return async (input,options={}) => {
    const response=await fetcher(input,options);
    const method=(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const expectedMissing=response.status===404 && ['GET','HEAD'].includes(method);
    const conflict=response.status===412 && method==='PUT';
    if (!response.ok && !expectedMissing && !conflict) throw new Error('STORAGE_REQUEST_FAILED');
    return response;
  };
}
export function createPlatformState(env,getStore,fetcher=fetch) {
  const backend=env.ORBITA_STATE_BACKEND || 'blobs';
  if (backend==='supabase') {
    if (env.ORBITA_PROJECT_REF!=='pfptagachuwclcxkmldb' || env.ORBITA_ORGANIZATION_ID!=='dgcoyccqqeyjhfatcasa') throw new Error('DATABASE_TARGET_REJECTED');
    return createEncryptedDatabase(env,fetcher);
  }
  if (backend!=='blobs') throw new Error('STORAGE_BACKEND_INVALID');
  return createBlobState(getStore({name:'orbita-private-v1',consistency:'strong',fetch:checkedStorageFetch()}),env);
}
export function createNetlifyHandler({env,getStore,fetcher=fetch}) {
  return async (request,context) => {
    const url=new URL(request.url);
    if (!url.pathname.startsWith('/orbita/api/')) return json({error:'NOT_FOUND'},404);
    url.pathname=url.pathname.slice('/orbita/api'.length);
    if (!available(context,env)) {
      if (url.pathname==='/health' && request.method==='GET') return json({service:'orbita',enabled:false,environment:'inactive'});
      return json({error:'DEPLOYMENT_NOT_ACTIVE'},503);
    }
    try {
      const database=createPlatformState(env,getStore,fetcher);
      if (url.pathname==='/operator/snapshot' && request.method==='GET') {
        if (!/^[A-Za-z0-9_-]{32,256}$/.test(env.ORBITA_OPERATOR_TOKEN || '') ||
          !await equalSecret(request.headers.get('authorization'),`Bearer ${env.ORBITA_OPERATOR_TOKEN}`)) return json({error:'FORBIDDEN'},403);
        if (!database.exportSnapshot) return json({error:'SNAPSHOT_NOT_AVAILABLE'},409);
        return json(await database.exportSnapshot());
      }
      const handler=createHandler({env,database,fetcher,waitUntil:typeof context.waitUntil==='function'?task=>context.waitUntil(task):undefined});
      return await handler(new Request(url,request));
    } catch { return json({error:'SERVICE_UNAVAILABLE'},503); }
  };
}
export function createNetlifyRecovery({env,fetcher=fetch}) {
  return async (_request,context) => {
    // Scheduled invocations report published=false even for the current production
    // deploy. They must never open storage directly. Dispatch to the canonical
    // receiver, which independently enforces its published-deployment guard.
    const target=deploymentTarget(env);
    const permitted=!!target && context?.site?.id===target.siteId && context?.account?.id===target.teamId &&
      context?.deploy?.context==='production' && env.ORBITA_ENABLED==='true' &&
      /^[A-Za-z0-9_-]{32,256}$/.test(env.ORBITA_WORKER_TOKEN || '');
    if (!permitted) {
      console.info('ORBITA_RECOVERY_SKIPPED',JSON.stringify({siteMatches:!!target&&context?.site?.id===target.siteId,
        accountMatches:!!target&&context?.account?.id===target.teamId,production:context?.deploy?.context==='production',
        published:context?.deploy?.published===true,enabled:env.ORBITA_ENABLED==='true'}));
      return;
    }
    // One job per scheduled invocation, processed by the published receiver.
    try {
      const response=await fetcher(target.origin+'/orbita/api/jobs/run',{
        method:'POST',redirect:'error',headers:{Authorization:`Bearer ${env.ORBITA_WORKER_TOKEN}`},
        signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('RECOVERY_TRIGGER_FAILED');
      const result=await response.json();
      if (response.status!==202 || result.scheduled!==true) throw new Error('RECOVERY_NOT_SCHEDULED');
      console.info('ORBITA_RECOVERY_DISPATCHED');
    }
    catch { console.error('ORBITA_RECOVERY_FAILED'); }
  };
}
