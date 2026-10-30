import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deploymentTarget} from '../orbita-server/deployment.mjs';
import {createNetlifyHandler,createNetlifyRecovery,isPublishedProduction} from '../orbita-server/netlify-runtime.mjs';
import {createPortalHandler} from '../orbita-server/portal.mjs';
// Synthetic deployment fixtures; never identifiers supplied to a hosting API.
const siteId='ab123456-1234-4234-9234-123456789abc',teamId='abcd1234567890abcdef1234',origin='https://orbita-migration.example';
const env={ORBITA_NETLIFY_SITE_ID:siteId,ORBITA_NETLIFY_TEAM_ID:teamId,ORBITA_PUBLIC_ORIGIN:origin,
 ORBITA_ENABLED:'true',ORBITA_STATE_BACKEND:'supabase',ORBITA_PROJECT_REF:'pfptagachuwclcxkmldb',ORBITA_ORGANIZATION_ID:'dgcoyccqqeyjhfatcasa',
 ORBITA_SUPABASE_URL:'https://pfptagachuwclcxkmldb.supabase.co',ORBITA_SUPABASE_SECRET_KEY:'sb_secret_fixture',ORBITA_META_APP_ID:'1782537496230918',
 ORBITA_CREDENTIAL_KEY:'ab'.repeat(32),ORBITA_OPERATOR_TOKEN:'operator-fixture-'.repeat(3),ORBITA_WORKER_TOKEN:'worker-fixture-'.repeat(3)};
const context={site:{id:siteId},account:{id:teamId},deploy:{context:'production',published:true}};
test('migration requires the complete authorized target and retains the client-site exclusion',()=>{
 assert.deepEqual(deploymentTarget(env),{siteId,teamId,origin});
 for(const change of [{ORBITA_NETLIFY_TEAM_ID:''},{ORBITA_NETLIFY_SITE_ID:''},{ORBITA_PUBLIC_ORIGIN:''},
  {ORBITA_PUBLIC_ORIGIN:'http://unsafe.example'},{ORBITA_PUBLIC_ORIGIN:'https://user:pass@unsafe.example'},
  {ORBITA_PUBLIC_ORIGIN:origin+'/path'},{ORBITA_PUBLIC_ORIGIN:origin+'?x=1'},
  {ORBITA_NETLIFY_SITE_ID:'65a5b934-b331-48c4-b66a-fa9db3d59a12'},
  {ORBITA_NETLIFY_SITE_ID:'3f695b44-f4e1-4d7f-a8a6-45794941b72e'}])assert.equal(deploymentTarget({...env,...change}),null);
 assert.equal(isPublishedProduction(context,env),true);
 assert.equal(isPublishedProduction({...context,site:{id:'aa3eb206-3126-4e99-bc91-46a4bb2d59d2'}},env),false);
});
test('only the authorized published receiver can query the existing platform database',async()=>{
 let reads=0;
 const handler=createNetlifyHandler({env,getStore:()=>{throw Error('NO_BLOBS');},fetcher:async url=>{
  reads++;assert.equal(url,env.ORBITA_SUPABASE_URL+'/rest/v1/rpc/orbita_status');return Response.json({tenants:[],channels:[],messages:{}});
 }});
 const request=()=>new Request(origin+'/orbita/api/operator/status',{headers:{Authorization:`Bearer ${env.ORBITA_OPERATOR_TOKEN}`}});
 assert.equal((await handler(request(),context)).status,200);assert.equal(reads,1);
 for(const invalid of [{...context,account:{id:'unrelated'}},{...context,site:{id:'unrelated'}},
  {...context,deploy:{context:'deploy-preview',published:false}},{...context,deploy:{context:'production',published:false}}])assert.equal((await handler(request(),invalid)).status,503);
 assert.equal(reads,1);
});
test('recovery sends its private token only to the configured canonical receiver',async()=>{
 let calls=0;
 const recovery=createNetlifyRecovery({env,fetcher:async(url,opts)=>{
  calls++;assert.equal(url,origin+'/orbita/api/jobs/run');assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,`Bearer ${env.ORBITA_WORKER_TOKEN}`);
  return Response.json({scheduled:true},{status:202});
 }});
 await recovery(null,{...context,deploy:{context:'production',published:false}});assert.equal(calls,1);
 await recovery(null,{...context,account:{id:'old-team'}});assert.equal(calls,1);
 await createNetlifyRecovery({env:{...env,ORBITA_PUBLIC_ORIGIN:'http://unsafe.example'},fetcher:()=>{throw Error('MUST_NOT_SEND');}})(null,context);
});
test('the migrated portal accepts its own origin and keeps cross-origin requests blocked',async()=>{
 const code='private-fixture-code-'.repeat(3);
 const configured={...env,ORBITA_PORTAL_ENABLED:'true',ORBITA_PORTAL_SESSION_KEY:'ad'.repeat(32),ORBITA_PORTAL_ACCOUNTS:JSON.stringify([{id:'alba',name:'Alba Vision',role:'admin',accessHash:createHash('sha256').update(code).digest('hex')}])};
 const handler=createPortalHandler({env:configured,database:{rpc:()=>{throw Error('LOGIN_DOES_NOT_WRITE');}}});
 const request=headerOrigin=>new Request(origin+'/orbita/panel/session',{method:'POST',headers:{Origin:headerOrigin,'Content-Type':'application/json'},body:JSON.stringify({account:'alba',code})});
 assert.equal((await handler(request('https://albavision.tech'),context)).status,403);
 const session=await handler(request(origin),context);assert.equal(session.status,200);assert.equal((await session.json()).role,'admin');
 assert.match(session.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await handler(request(origin),{...context,deploy:{context:'deploy-preview',published:false}})).status,404);
});
