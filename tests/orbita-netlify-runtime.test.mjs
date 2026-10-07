import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetlifyHandler,createNetlifyRecovery,checkedStorageFetch} from '../orbita-server/netlify-runtime.mjs';
const env={ORBITA_ENABLED:'true',ORBITA_CREDENTIAL_KEY:'ad'.repeat(32),ORBITA_META_VERIFY_TOKEN:'verify-fixture',
  ORBITA_OPERATOR_TOKEN:'operator-fixture-'.repeat(3),ORBITA_WORKER_TOKEN:'worker-fixture-'.repeat(3)};
const context={site:{id:'aa3eb206-3126-4e99-bc91-46a4bb2d59d2'},account:{id:'6864502cf6cc9967e3dac6db'},deploy:{context:'production',published:true},waitUntil:()=>{}};
test('storage errors cannot be misreported as successful conditional writes',async()=>{
  for (const status of [401,403,429,500,503]) await assert.rejects(checkedStorageFetch(async()=>new Response('',{status}))('https://storage.test',{method:'PUT'}),/STORAGE_REQUEST_FAILED/);
  assert.equal((await checkedStorageFetch(async()=>new Response('',{status:412}))('https://storage.test',{method:'PUT'})).status,412);
  assert.equal((await checkedStorageFetch(async()=>new Response('',{status:404}))('https://storage.test',{method:'GET'})).status,404);
  await assert.rejects(checkedStorageFetch(async()=>new Response('',{status:404}))('https://storage.test',{method:'PUT'}));
});
test('preview, unpublished and unrelated sites cannot open the production store',async()=>{
  let opens=0;const getStore=()=>{opens++;throw new Error('UNEXPECTED');};
  const handler=createNetlifyHandler({env,getStore});
  for (const invalid of [{...context,deploy:{context:'deploy-preview',published:false}},{...context,deploy:{context:'production',published:false}},
    {...context,site:{id:'customer-site'}},{...context,account:{id:'customer-team'}}]) {
    assert.equal((await handler(new Request('https://preview.test/orbita/api/operator/status'),invalid)).status,503);
    assert.equal((await (await handler(new Request('https://preview.test/orbita/api/health'),invalid)).json()).enabled,false);
  }
  assert.equal(opens,0);
});
test('scheduled production recovery dispatches only to the guarded canonical receiver',async()=>{
  let reads=0, dispatches=0;const tasks=[];
  const receiver=createNetlifyHandler({env,getStore:()=>({getWithMetadata:async()=>{reads++;return null;}})});
  const recovery=createNetlifyRecovery({env,getStore:()=>{throw new Error('SCHEDULER_MUST_NOT_OPEN_STORAGE');},
    fetcher:async(url,options)=>{
      dispatches++;assert.equal(url,'https://albavision.tech/orbita/api/jobs/run');
      assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,`Bearer ${env.ORBITA_WORKER_TOKEN}`);
      return receiver(new Request(url,options),{...context,waitUntil:task=>tasks.push(task)});
    }});
  await recovery(new Request('https://scheduled.test/'),{...context,deploy:{context:'production',published:false}});
  await Promise.all(tasks);assert.equal(dispatches,1);assert.equal(reads,1);
  for (const invalid of [{...context,deploy:{context:'deploy-preview',published:false}},
    {...context,site:{id:'customer-site'}},{...context,account:{id:'customer-team'}}]) {
    await recovery(new Request('https://scheduled.test/'),invalid);
  }
  assert.equal(dispatches,1);
  for (const overrides of [{ORBITA_ENABLED:'false'},{ORBITA_WORKER_TOKEN:''}]) {
    await createNetlifyRecovery({env:{...env,...overrides},fetcher:()=>{throw new Error('MUST_NOT_DISPATCH');}})(null,context);
  }
  assert.equal((await receiver(new Request('https://albavision.tech/orbita/api/jobs/run',{method:'POST',
    headers:{Authorization:`Bearer ${env.ORBITA_WORKER_TOKEN}`}}),{...context,deploy:{context:'production',published:false}})).status,503);
});
test('domain route retains the exact webhook bytes and rejects unsigned posts without reading storage',async()=>{
  let reads=0;const getStore=options=>{assert.equal(options.name,'orbita-private-v1');assert.equal(options.consistency,'strong');return {
    getWithMetadata:async()=>{reads++;return null;},set:async()=>{throw new Error('UNEXPECTED_WRITE');}};};
  const handler=createNetlifyHandler({env:{...env,ORBITA_META_APP_SECRET:'secret'},getStore});
  const challenge=await handler(new Request('https://albavision.tech/orbita/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-fixture&hub.challenge=123'),context);
  assert.equal(challenge.status,200);assert.equal(await challenge.text(),'123');
  assert.equal((await handler(new Request('https://albavision.tech/orbita/api/webhooks/whatsapp',{method:'POST',body:'{}'}),context)).status,403);
  assert.equal((await handler(new Request('https://albavision.tech/orbita/api/operator/status'),context)).status,403);
  assert.equal(reads,0);
});
test('Supabase selection is explicit, locked to the selected platform project and never falls back to Blobs',async()=>{
  let calls=0;const configured={...env,ORBITA_STATE_BACKEND:'supabase',ORBITA_PROJECT_REF:'pfptagachuwclcxkmldb',
    ORBITA_ORGANIZATION_ID:'dgcoyccqqeyjhfatcasa',ORBITA_SUPABASE_URL:'https://pfptagachuwclcxkmldb.supabase.co',
    ORBITA_SUPABASE_SECRET_KEY:'sb_secret_fixture',ORBITA_META_APP_ID:'1782537496230918'};
  const getStore=()=>{throw new Error('NO_BLOBS_FALLBACK');};
  const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://pfptagachuwclcxkmldb.supabase.co/rest/v1/rpc/orbita_status');
    assert.equal(options.headers.apikey,configured.ORBITA_SUPABASE_SECRET_KEY);return Response.json({tenants:[],channels:[],messages:{}});};
  const request=()=>new Request('https://albavision.tech/orbita/api/operator/status',{headers:{Authorization:`Bearer ${env.ORBITA_OPERATOR_TOKEN}`}});
  assert.equal((await createNetlifyHandler({env:configured,getStore,fetcher})(request(),context)).status,200);
  assert.equal(calls,1);
  for(const invalid of [{ORBITA_PROJECT_REF:'lajstcbseugkjmkasnjd'},{ORBITA_ORGANIZATION_ID:'cqkvpdutzjkidfqjeyav'},
    {ORBITA_SUPABASE_URL:'https://other.supabase.co'},{ORBITA_SUPABASE_SECRET_KEY:''},{ORBITA_STATE_BACKEND:'unknown'}]) {
    assert.equal((await createNetlifyHandler({env:{...configured,...invalid},getStore,fetcher})(request(),context)).status,503);
  }
  assert.equal(calls,1);
});
test('snapshot endpoint exposes only ciphertext to the private operator and remains unavailable in previews',async()=>{
  let reads=0;const getStore=()=>({getWithMetadata:async()=>{reads++;return {data:'encrypted-fixture',etag:'one'};}});
  const handler=createNetlifyHandler({env,getStore});
  const request=token=>new Request('https://albavision.tech/orbita/api/operator/snapshot',{headers:token?{Authorization:`Bearer ${token}`}:{}});
  for(const token of [undefined,'wrong',env.ORBITA_WORKER_TOKEN]) assert.equal((await handler(request(token),context)).status,403);
  assert.equal(reads,0);
  const response=await handler(request(env.ORBITA_OPERATOR_TOKEN),context);assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ciphertext:'encrypted-fixture',etag:'one'});assert.equal(reads,1);
  assert.equal((await handler(request(env.ORBITA_OPERATOR_TOKEN),{...context,deploy:{context:'deploy-preview',published:false}})).status,503);
  assert.equal(reads,1);
});
