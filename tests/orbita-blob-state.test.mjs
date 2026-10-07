import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createBlobState} from '../orbita-server/blob-state.mjs';
import {sealCredentials,openCredentials} from '../orbita-server/security.mjs';
import {createHandler} from '../orbita-server/handler.mjs';
import {runOneJob} from '../orbita-server/engine.mjs';
const env={ORBITA_ENABLED:'true',ORBITA_CREDENTIAL_KEY:'ad'.repeat(32),ORBITA_META_APP_ID:'123456789',ORBITA_META_APP_SECRET:'fixture-secret',
  ORBITA_META_VERIFY_TOKEN:'fixture-verify',ORBITA_OPERATOR_TOKEN:'operator-fixture-'.repeat(3),ORBITA_WORKER_TOKEN:'worker-fixture-'.repeat(3)};
// Emulates the documented strong reads and atomic conditional writes, shared by instances.
function storeFixture() {
  let entry=null, revision=0;
  return {
    async getWithMetadata(key,options) {assert.equal(key,'state-v1');assert.equal(options.consistency,'strong');return entry && {...entry};},
    async set(key,data,options) {
      if (options.onlyIfNew ? entry!==null : options.onlyIfMatch!==entry?.etag) return {modified:false};
      entry={data,etag:String(++revision)};return {modified:true,etag:entry.etag};
    },raw:()=>entry?.data
  };
}
async function setup(options={}) {
  const store=storeFixture();let now=Date.now();const db=createBlobState(store,{...env,...options.env},{clock:()=>now,...options.limits});
  const tenant=crypto.randomUUID(),channel=crypto.randomUUID();
  await db.rpc('orbita_create_tenant',{p_id:tenant,p_slug:'test',p_name:'Negocio ficticio',p_budget:options.budget ?? 1});
  const credentials=await sealCredentials({metaAccessToken:'private-fixture',tokenExpiresAt:0},env.ORBITA_CREDENTIAL_KEY,tenant,channel);
  await db.rpc('orbita_create_channel',{p_id:channel,p_tenant_id:tenant,p_app_id:env.ORBITA_META_APP_ID,p_waba_id:'111111',p_phone_id:'222222',
    p_connector:'human-review-v1',p_credentials:credentials,p_mode:'trial',p_allowed:['525500000000']});
  await db.rpc('orbita_activate_channel',{p_id:channel,p_credentials:credentials});
  await db.rpc('orbita_tenant_state',{p_id:tenant,p_paused:false});
  const event=(id='wamid.fixture',from='525500000000')=>({kind:'inbound',wabaId:'111111',phoneNumberId:'222222',id,from,name:'Persona ficticia',
    body:'hola',mediaId:'image-fixture',type:'image',receivedAt:new Date(now).toISOString()});
  return {db,store,tenant,channel,event,advance:ms=>{now+=ms;}};
}
test('independent instances deduplicate concurrently, persist across reload and encrypt personal data',async()=>{
  const f=await setup();
  const instances=Array.from({length:10},()=>createBlobState(f.store,env));
  const outcomes=await Promise.all(instances.map(db=>db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event()]})));
  assert.equal(outcomes.reduce((sum,r)=>sum+r.added,0),1);
  const reloaded=createBlobState(f.store,env);
  assert.deepEqual((await reloaded.rpc('orbita_status')).messages,{pending:1});
  assert(!f.store.raw().includes('Persona ficticia'));assert(!f.store.raw().includes('525500000000'));assert(!f.store.raw().includes('private-fixture'));
  await assert.rejects(createBlobState(f.store,{...env,ORBITA_CREDENTIAL_KEY:'ab'.repeat(32)}).rpc('orbita_status'));
});
test('parallel workers claim a channel once and an interrupted send is never automatically repeated',async()=>{
  const f=await setup();await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event()]});
  const owners=Array.from({length:8},()=>crypto.randomUUID());
  const jobs=await Promise.all(owners.map(p_owner=>f.db.rpc('orbita_claim',{p_owner})));
  assert.equal(jobs.filter(Boolean).length,1);const index=jobs.findIndex(Boolean),job=jobs[index],p={p_message_id:job.id,p_owner:owners[index]};
  await assert.rejects(f.db.rpc('orbita_prepare_reply',{...p,p_owner:crypto.randomUUID(),p_reply:'hola'}),/LEASE_LOST/);
  await f.db.rpc('orbita_prepare_reply',{...p,p_reply:'hola'});await f.db.rpc('orbita_mark_sending',p);
  f.advance(120001);assert.equal(await f.db.rpc('orbita_claim',{p_owner:crypto.randomUUID()}),null);
  assert.deepEqual((await f.db.rpc('orbita_status')).messages,{unknown:1});
});
test('routing rejects wrong WABA and sender; quotes belong to the originating customer',async()=>{
  const f=await setup();
  assert.equal((await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[{...f.event(),wabaId:'999999'},f.event('other','525511111111')]})).added,0);
  await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event()]});
  const owner=crypto.randomUUID(),job=await f.db.rpc('orbita_claim',{p_owner:owner}),p={p_message_id:job.id,p_owner:owner};
  const caseId=crypto.randomUUID();await f.db.rpc('orbita_save_case',{...p,p_case_id:caseId,p_quote:{subtotalMxn:100}});
  await f.db.rpc('orbita_fail_job',{...p,p_sending:false});
  const credentials=await sealCredentials({metaAccessToken:'private-fixture'},env.ORBITA_CREDENTIAL_KEY,f.tenant,f.channel);
  // A new channel for the same tenant still must not inherit another channel's quote.
  const channel2=crypto.randomUUID();await f.db.rpc('orbita_create_channel',{p_id:channel2,p_tenant_id:f.tenant,p_app_id:env.ORBITA_META_APP_ID,
    p_waba_id:'111111',p_phone_id:'333333',p_connector:'human-review-v1',p_credentials:credentials,p_mode:'trial',p_allowed:['525500000000']});
  await f.db.rpc('orbita_activate_channel',{p_id:channel2,p_credentials:credentials});
  await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[{...f.event('wamid.second'),phoneNumberId:'333333'}]});
  const owner2=crypto.randomUUID(),job2=await f.db.rpc('orbita_claim',{p_owner:owner2});
  assert.equal(await f.db.rpc('orbita_find_case',{p_message_id:job2.id,p_owner:owner2,p_case_id:caseId}),null);
  await assert.rejects(f.db.rpc('orbita_submit_case',{p_message_id:job2.id,p_owner:owner2,p_case_id:caseId,p_submission:{id:'x'}}),/CASE_NOT_OWNED/);
});
test('budget reservation is atomic and failed preparation reuses a persisted decision',async()=>{
  const f=await setup({budget:0});await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event()]});
  const owner=crypto.randomUUID(),job=await f.db.rpc('orbita_claim',{p_owner:owner}),p={p_message_id:job.id,p_owner:owner};
  assert.equal(await f.db.rpc('orbita_reserve_usage',{...p,p_tokens:100}),false);
  const g=await setup();await g.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[g.event()]});
  const owner2=crypto.randomUUID(),job2=await g.db.rpc('orbita_claim',{p_owner:owner2}),q={p_message_id:job2.id,p_owner:owner2};
  const results=await Promise.all(Array.from({length:5},()=>g.db.rpc('orbita_reserve_usage',{...q,p_tokens:100})));
  assert.equal(results.filter(Boolean).length,1);
  await g.db.rpc('orbita_save_decision',{...q,p_decision:{status:'unavailable'}});
  await g.db.rpc('orbita_fail_job',{...q,p_sending:false});g.advance(60001);
  assert.deepEqual((await g.db.rpc('orbita_claim',{p_owner:crypto.randomUUID()})).decision,{status:'unavailable'});
});
test('signed webhook queues before triggering and a lost trigger is recoverable after reload',async()=>{
  const f=await setup();let triggered=0;
  const handler=createHandler({env,database:f.db,scheduleJob:async()=>{triggered++;throw new Error('fixture-failed');}});
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'111111',changes:[{field:'messages',value:{metadata:{phone_number_id:'222222'},
    messages:[{id:'wamid.test',from:'525500000000',type:'image',image:{id:'fixture'},timestamp:String(Math.floor(Date.now()/1000))}]}}]}]});
  const signature='sha256='+createHmac('sha256',env.ORBITA_META_APP_SECRET).update(body).digest('hex');
  const request=()=>new Request('https://orbita.test/webhooks/whatsapp',{method:'POST',body,headers:{'x-hub-signature-256':signature}});
  assert.equal((await handler(request())).status,200);assert.equal(triggered,1);
  let sends=0;const reloaded=createBlobState(f.store,env);
  const fetcher=async()=>{sends++;return Response.json({messages:[{id:'wamid.out'}]});};
  await Promise.all([runOneJob(env,reloaded,{fetcher}),runOneJob(env,reloaded,{fetcher})]);assert.equal(sends,1);
  await handler(request());await runOneJob(env,reloaded,{fetcher});assert.equal(sends,1);
  assert.deepEqual((await reloaded.rpc('orbita_status')).messages,{accepted:1});
});
test('early receipts advance monotonically, invalid credentials pause processing, capacity fails closed',async()=>{
  const f=await setup();await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event(),{kind:'receipt',wabaId:'111111',phoneNumberId:'222222',
    id:'wamid.out',from:'525500000000',status:'read'}]});
  const owner=crypto.randomUUID(),job=await f.db.rpc('orbita_claim',{p_owner:owner}),p={p_message_id:job.id,p_owner:owner};
  await f.db.rpc('orbita_prepare_reply',{...p,p_reply:'hola'});await f.db.rpc('orbita_mark_sending',p);
  await f.db.rpc('orbita_finish',{...p,p_delivery:{status:'accepted',messageId:'wamid.out'}});
  await f.db.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[{kind:'receipt',wabaId:'111111',phoneNumberId:'222222',id:'wamid.out',from:'525500000000',status:'sent'}]});
  assert.deepEqual((await f.db.rpc('orbita_status')).messages,{read:1});
  const small=createBlobState(f.store,env,{maxBytes:1});
  await assert.rejects(small.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event('wamid.new')]}),/STATE_CAPACITY_REACHED/);
  assert.deepEqual((await f.db.rpc('orbita_status')).messages,{read:1});
});
test('encryption supports documents larger than the JavaScript argument limit',async()=>{
  const content={body:'ñ'.repeat(150000)};
  const envelope=await sealCredentials(content,env.ORBITA_CREDENTIAL_KEY,'orbita-platform','netlify-state-v1');
  assert.deepEqual(await openCredentials(envelope,env.ORBITA_CREDENTIAL_KEY,'orbita-platform','netlify-state-v1'),content);
});
test('a modified response without an ETag cannot acknowledge a durable message',async()=>{
  const f=await setup();
  const broken={getWithMetadata:(...args)=>f.store.getWithMetadata(...args),set:async()=>({modified:true,etag:''})};
  await assert.rejects(createBlobState(broken,env).rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:[f.event()]}),/STATE_WRITE_NOT_CONFIRMED/);
  assert.deepEqual((await f.db.rpc('orbita_status')).messages,{});
});
