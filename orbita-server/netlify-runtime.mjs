import {createBlobState} from './blob-state.mjs';
import {createHandler} from './handler.mjs';
import {runOneJob} from './engine.mjs';
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
export function createNetlifyRecovery({env,getStore,fetcher=fetch}) {
  return async (_request,context) => {
    if (!available(context) || env.ORBITA_ENABLED!=='true') return;
    // One job per scheduled invocation. The published receiver processes arrivals
    // immediately with waitUntil; this is the recovery path for interrupted work.
    try { await runOneJob(env,state(env,getStore),{fetcher}); }
    catch { console.error('ORBITA_RECOVERY_FAILED'); }
  };
}
