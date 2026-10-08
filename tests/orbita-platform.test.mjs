import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {sealCredentials,openCredentials,validSignature,canonicalPhone} from '../orbita-server/security.mjs';
import {createHandler} from '../orbita-server/handler.mjs';
import {createDatabase} from '../orbita-server/database.mjs';
import {classify,MODEL} from '../orbita-server/jev.mjs';
import {extractEvents} from '../orbita-server/webhook.mjs';
import {runOneJob,sendReply} from '../orbita-server/engine.mjs';
import {prepareSankalpaReply} from '../orbita-server/sankalpa.mjs';
import {verifyDurableMetaCredential} from '../orbita-server/meta-credentials.mjs';

const master = 'a1'.repeat(32);
const env = {ORBITA_ENABLED:'true',ORBITA_CREDENTIAL_KEY:master,ORBITA_META_APP_ID:'123456789',
  ORBITA_META_APP_SECRET:'fixture-app-secret',ORBITA_META_VERIFY_TOKEN:'fixture-verify',
  ORBITA_OPERATOR_TOKEN:'fixture-operator-'.repeat(3),ORBITA_WORKER_TOKEN:'fixture-worker-'.repeat(3),ORBITA_TYPESAFE_API_KEY:'fixture-jev'};
const inbound = {id:'wamid.inbound',from:'5215500000000',name:'Cliente ficticio',body:'¿Qué comida tienen disponible?',receivedAt:new Date().toISOString()};
const jobTemplate = {id:'message-a',tenantId:'tenant-a',tenantName:'Negocio A',channelId:'channel-a',phoneNumberId:'123456789',
  connector:'human-review-v1',jevEnabled:false,credentialRevision:1,message:inbound};
const credentialFixture = {metaAccessToken:'fixture-meta-token',tokenExpiresAt:0};
const answer = {model:MODEL,usage:{input_tokens:100,output_tokens:10},answers:{intencion:{type:'choice',choice:'menu',confidence:1,
  probabilities:{menu:1,pedido:0,confirmar:0,ayuda:0,otro:0}}}};

test('encrypted credentials are bound to both tenant and channel and reject tampering',async()=>{
  const sealed = await sealCredentials(credentialFixture,master,'tenant-a','channel-a');
  assert(!sealed.includes('fixture-meta-token'));
  assert.deepEqual(await openCredentials(sealed,master,'tenant-a','channel-a'),credentialFixture);
  await assert.rejects(openCredentials(sealed,master,'tenant-b','channel-a'));
  await assert.rejects(openCredentials(sealed,master,'tenant-a','channel-b'));
  const changed = JSON.parse(sealed); changed.ciphertext=(changed.ciphertext[0]==='A'?'B':'A')+changed.ciphertext.slice(1);
  await assert.rejects(openCredentials(JSON.stringify(changed),master,'tenant-a','channel-a'));
});
test('webhook authenticates exact bytes before any database operation',async()=>{
  const operations=[]; const db={rpc:async(name,input)=>{operations.push({name,input});return {added:1};}};
  const handler=createHandler({env,database:db});
  const payload=JSON.stringify({object:'whatsapp_business_account',entry:[]});
  const signature='sha256='+createHmac('sha256',env.ORBITA_META_APP_SECRET).update(payload).digest('hex');
  let result=await handler(new Request('https://orbita.test/webhooks/whatsapp',{method:'POST',body:payload,headers:{'x-hub-signature-256':signature}}));
  assert.equal(result.status,200);assert.equal(operations.length,1);
  result=await handler(new Request('https://orbita.test/webhooks/whatsapp',{method:'POST',body:payload+' ',headers:{'x-hub-signature-256':signature}}));
  assert.equal(result.status,403);assert.equal(operations.length,1);
  assert.equal(await validSignature(new TextEncoder().encode(payload),signature,'wrong'),false);
});
test('challenge rejects wrong token and privileged routes reject absent or wrong credentials',async()=>{
  let operations=0;const handler=createHandler({env,database:{rpc:async()=>{operations++;return {};}}});
  assert.equal((await handler(new Request('https://orbita.test/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=fixture-verify&hub.challenge=987'))).status,200);
  assert.equal((await handler(new Request('https://orbita.test/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=987'))).status,403);
  assert.equal((await handler(new Request('https://orbita.test/operator/status'))).status,403);
  assert.equal((await handler(new Request('https://orbita.test/jobs/run',{method:'POST',headers:{Authorization:`Bearer ${env.ORBITA_OPERATOR_TOKEN}`}}))).status,403);
  assert.equal(operations,0);
});
test('private routes fail closed with weak or shared credentials; worker cannot administer clients',async()=>{
  let operations=0; const db={rpc:async()=>{operations++;return {};}};
  for(const invalid of [{...env,ORBITA_WORKER_TOKEN:'short'},{...env,ORBITA_WORKER_TOKEN:env.ORBITA_OPERATOR_TOKEN}]) {
    const handler=createHandler({env:invalid,database:db});
    assert.equal((await handler(new Request('https://orbita.test/operator/status',{headers:{Authorization:`Bearer ${invalid.ORBITA_OPERATOR_TOKEN}`}}))).status,503);
    assert.equal((await handler(new Request('https://orbita.test/jobs/run',{method:'POST',headers:{Authorization:`Bearer ${invalid.ORBITA_WORKER_TOKEN}`}}))).status,503);
  }
  const handler=createHandler({env,database:db});
  assert.equal((await handler(new Request('https://orbita.test/operator/status',{headers:{Authorization:`Bearer ${env.ORBITA_WORKER_TOKEN}`}}))).status,403);
  assert.equal(operations,0);
  assert.equal((await handler(new Request('https://orbita.test/operator/status',{headers:{Authorization:`Bearer ${env.ORBITA_OPERATOR_TOKEN}`}}))).status,200);
  assert.equal(operations,1);
});
test('scheduler acknowledges immediately while the held job runs in waitUntil',async()=>{
  let release;const claimed=new Promise(resolve=>{release=resolve;});const tasks=[];
  const handler=createHandler({env,database:{rpc:async()=>claimed},waitUntil:task=>tasks.push(task)});
  const response=await handler(new Request('https://orbita.test/jobs/run',{method:'POST',headers:{Authorization:`Bearer ${env.ORBITA_WORKER_TOKEN}`}}));
  assert.equal(response.status,202);assert.deepEqual(await response.json(),{scheduled:true});assert.equal(tasks.length,1);
  release(null);await tasks[0];
});
test('chunked oversized webhook does not write data',async()=>{
  let wrote=false;const handler=createHandler({env,database:{rpc:async()=>{wrote=true;}}});
  const result=await handler(new Request('https://orbita.test/webhooks/whatsapp',{method:'POST',body:'x'.repeat(262145)}));
  assert.equal(result.status,413);assert.equal(wrote,false);
});
test('database cannot be pointed at a client project',()=>{
  assert.throws(()=>createDatabase({ORBITA_PROJECT_REF:'lajstcbseugkjmkasnjd',ORBITA_SUPABASE_URL:'https://lajstcbseugkjmkasnjd.supabase.co',ORBITA_SUPABASE_SECRET_KEY:'fixture'}));
  assert.throws(()=>createDatabase({ORBITA_PROJECT_REF:'a'.repeat(20),ORBITA_SUPABASE_URL:'https://example.com',ORBITA_SUPABASE_SECRET_KEY:'fixture'}));
});
test('payload tenant claims are discarded and Mexican legacy numbers are normalized',()=>{
  const payload={object:'whatsapp_business_account',tenantId:'attacker',entry:[{id:'111111',changes:[{field:'messages',value:{metadata:{phone_number_id:'222222'},
    messages:[{id:'wamid.test',from:'5215500000000',type:'text',timestamp:String(Math.floor(Date.now()/1000)),text:{body:'tenantId=other'},tenantId:'other'}]}}]}]};
  const events=extractEvents(payload);assert.equal(events.length,1);assert.equal(events[0].from,'525500000000');assert.equal(events[0].tenantId,undefined);
  assert.equal(events[0].phoneNumberId,'222222');assert.equal(canonicalPhone('+52 55 0000 0000'),'525500000000');
});
test('Jev receives only message text as state and rejects a changed model decision',async()=>{
  let request;const result=await classify('¿Qué comida hay?','Negocio A','fixture',async(url,options)=>{request=JSON.parse(options.body);return Response.json(answer);});
  assert.equal(result.intent,'menu');assert.deepEqual(request.state,{mensaje_del_cliente:'¿Qué comida hay?'});
  assert.equal((await classify('consulta','Negocio A','fixture',async()=>Response.json({...answer,model:'different'}))).routable,false);
});
test('outbox is persisted before sending and unknown delivery is not sent again',async()=>{
  const job={...jobTemplate,credentials:await sealCredentials(credentialFixture,master,'tenant-a','channel-a')};
  const calls=[];let claimed=false,sends=0;
  const db={rpc:async(name,input)=>{calls.push(name);if(name==='orbita_claim'){if(claimed)return null;claimed=true;return job;}if(name==='orbita_finish')assert.equal(input.p_delivery.status,'unknown');return null;}};
  await runOneJob(env,db,{fetcher:async()=>{sends++;assert(calls.includes('orbita_mark_sending'));throw new Error('timeout');}});
  assert.equal((await runOneJob(env,db,{fetcher:async()=>{sends++;}})).processed,0);assert.equal(sends,1);
  assert(calls.indexOf('orbita_prepare_reply')<calls.indexOf('orbita_mark_sending'));
});
test('a failed outbox persist prevents the Meta call',async()=>{
  let sends=0;const job={...jobTemplate,credentials:await sealCredentials(credentialFixture,master,'tenant-a','channel-a')};
  const db={rpc:async(name)=>{if(name==='orbita_claim')return job;if(name==='orbita_mark_sending')throw new Error('db unavailable');return null;}};
  await runOneJob(env,db,{fetcher:async()=>{sends++;return Response.json({messages:[{id:'wamid.reply'}]});}});assert.equal(sends,0);
});
test('Meta reply uses the registered sender and canonical recipient; expired window does not call Meta',async()=>{
  let calls=0;const result=await sendReply(jobTemplate,'Respuesta',credentialFixture,async(url,options)=>{
    calls++;assert.equal(url,'https://graph.facebook.com/v25.0/123456789/messages');assert.equal(JSON.parse(options.body).to,'525500000000');
    return Response.json({messages:[{id:'wamid.reply'}]});});assert.equal(result.status,'accepted');
  assert.equal((await sendReply({...jobTemplate,message:{...inbound,receivedAt:'2020-01-01T00:00:00Z'}},'Respuesta',credentialFixture,async()=>{calls++;})).status,'expired');assert.equal(calls,1);
});
test('a budget block does not call Jev',async()=>{
  const job={...jobTemplate,jevEnabled:true,credentials:await sealCredentials(credentialFixture,master,'tenant-a','channel-a')};let modelCalls=0;
  const db={rpc:async(name)=>name==='orbita_claim'?job:name==='orbita_reserve_usage'?false:null};
  await runOneJob(env,db,{fetcher:async(url)=>{if(url.includes('typesafe')){modelCalls++;throw new Error();}return Response.json({messages:[{id:'wamid.reply'}]});}});assert.equal(modelCalls,0);
});
test('free acceptance and media never register a request; a missing owned reference cannot submit',async()=>{
  let submitted=0;const connector={submit:async()=>{submitted++;}};const db={rpc:async()=>null};
  await prepareSankalpaReply({...jobTemplate,message:{...inbound,body:'sí, adelante'}},{routable:true,intent:'confirmar'},connector,db,'owner');
  await prepareSankalpaReply({...jobTemplate,message:{...inbound,body:'sankalpa confirmar 11111111-1111-1111-1111-111111111111'}},null,connector,db,'owner');
  const reply=await prepareSankalpaReply({...jobTemplate,message:{...inbound,mediaId:'proof-file'}},null,connector,db,'owner');
  assert.equal(submitted,0);assert(reply.includes('sin verificar'));
});
test('activation rejects temporary and wrong-asset Meta credentials',async()=>{
  const channel={wabaId:'111111',phoneNumberId:'222222'};
  const info={is_valid:true,app_id:env.ORBITA_META_APP_ID,expires_at:0,data_access_expires_at:0,scopes:['whatsapp_business_messaging','whatsapp_business_management']};
  await assert.rejects(verifyDurableMetaCredential(credentialFixture,channel,env,async()=>Response.json({data:{...info,expires_at:123}})));
  await assert.rejects(verifyDurableMetaCredential(credentialFixture,channel,env,async(url)=>url.includes('debug_token')?Response.json({data:info}):Response.json({data:[{id:'999999'}]})));
  const verified=await verifyDurableMetaCredential(credentialFixture,channel,env,async(url)=>url.includes('debug_token')?Response.json({data:info}):Response.json({data:[{id:'222222'}]}));
  assert.equal(verified.tokenExpiresAt,0);assert(verified.tokenVerifiedAt);
});

test('coexistence activation requires Meta to confirm the existing app and Cloud API on the same number',async()=>{
  const channel={wabaId:'111111',phoneNumberId:'222222',coexistence:true};
  const info={is_valid:true,app_id:env.ORBITA_META_APP_ID,expires_at:0,scopes:['whatsapp_business_messaging','whatsapp_business_management']};
  const fetcher=state=>async url=>Response.json(url.includes('debug_token')?{data:info}:url.includes('/phone_numbers')?{data:[{id:'222222'}]}:{id:'222222',platform_type:'CLOUD_API',display_phone_number:'+52 55 0000 0088',is_on_biz_app:state});
  await assert.rejects(verifyDurableMetaCredential(credentialFixture,channel,env,fetcher(false)),/COEXISTENCE_NOT_VERIFIED/);
  const result=await verifyDurableMetaCredential(credentialFixture,channel,env,fetcher(true));assert.equal(result.coexistence,true);
});
