import {createBlobState} from './blob-state.mjs';
import {createHandler} from './handler.mjs';
const SITE = 'aa3eb206-3126-4e99-bc91-46a4bb2d59d2';
// accountId from this site's Netlify production build, not its Visual Editor team ID.
const TEAM = '6864502cf6cc9967e3dac6db';
const available = context => context?.site?.id===SITE && context?.account?.id===TEAM && context?.deploy?.context==='production' && context?.deploy?.published===true;
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
function state(env,getStore) {
  return createBlobState(getStore({name:'orbita-private-v1',consistency:'strong',fetch:checkedStorageFetch()}),env);
}
export function createNetlifyHandler({env,getStore,fetcher=fetch}) {
  return async (request,context) => {
    const url=new URL(request.url);
    if (!url.pathname.startsWith('/orbita/api/')) return json({error:'NOT_FOUND'},404);
    url.pathname=url.pathname.slice('/orbita/api'.length);
    if (!available(context)) {
      if (url.pathname==='/health' && request.method==='GET') return json({service:'orbita',enabled:false,environment:'inactive'});
      return json({error:'DEPLOYMENT_NOT_ACTIVE'},503);
    }
    try {
      const database=state(env,getStore);
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
    const permitted=context?.site?.id===SITE && context?.account?.id===TEAM &&
      context?.deploy?.context==='production' && env.ORBITA_ENABLED==='true' &&
      /^[A-Za-z0-9_-]{32,256}$/.test(env.ORBITA_WORKER_TOKEN || '');
    if (!permitted) {
      console.info('ORBITA_RECOVERY_SKIPPED',JSON.stringify({siteMatches:context?.site?.id===SITE,
        accountMatches:context?.account?.id===TEAM,production:context?.deploy?.context==='production',
        published:context?.deploy?.published===true,enabled:env.ORBITA_ENABLED==='true'}));
      return;
    }
    // One job per scheduled invocation, processed by the published receiver.
    try {
      const response=await fetcher('https://albavision.tech/orbita/api/jobs/run',{
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
