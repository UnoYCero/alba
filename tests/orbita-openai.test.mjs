import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classify,MODEL,intentRequest,estimateInputTokens} from '../orbita-server/openai.mjs';
import {classificationConfig,presentAgentSummary} from '../orbita-server/ai.mjs';
import {runOneJob} from '../orbita-server/engine.mjs';
import {sealCredentials} from '../orbita-server/security.mjs';
import {commerceFixture,tenant} from '../scripts/commerce-fixture.mjs';
const result=(answer={intent:'menu',confidence:.99},extra={})=>({id:'resp_fixture',object:'response',status:'completed',model:MODEL,
 output:[{type:'message',id:'msg_fixture',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(answer),annotations:[]}]}],
 usage:{input_tokens:100,output_tokens:30,total_tokens:130},...extra});
test('OpenAI sends only the message with a strict schema, pinned endpoint, no storage and no retry',async()=>{
 let calls=0;
 const decision=await classify('¿Qué comida tienen?','Negocio','fixture-key',async(url,options)=>{
  calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body);assert.deepEqual(body.input,[{role:'user',content:'¿Qué comida tienen?'}]);
  assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.max_output_tokens,512);
  assert.equal(body.tools,undefined);assert(!JSON.stringify(body).includes('fixture-key'));
  return Response.json(result());
 });
 assert.equal(calls,1);assert.equal(decision.intent,'menu');assert.equal(decision.routable,true);assert.deepEqual(decision.usage,{inputTokens:100,outputTokens:30});
 assert(estimateInputTokens('x'.repeat(12000),'Negocio')<20000);
});
test('refusal, incomplete, changed model, invented intent and low confidence do not route',async()=>{
 for(const response of [result({}, {output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'No'}]}]}),result(undefined,{status:'incomplete'}),result(undefined,{model:'changed'}),result({intent:'pay',confidence:1}),result({intent:'menu',confidence:.2})]){
  const decision=await classify('mensaje','Negocio','fixture',async()=>Response.json(response));assert.equal(decision.routable,false);assert.equal(decision.usage.outputTokens,30);
 }
 let calls=0;await assert.rejects(classify('hola','Negocio','fixture',async()=>{calls++;return Response.json({error:{message:'sensitive-provider-error'}},{status:429});}),{message:'OPENAI_NOT_AVAILABLE'});assert.equal(calls,1);
 await assert.rejects(classify('x'.repeat(12001),'Negocio','fixture',()=>{throw Error('must not call');}),{message:'OPENAI_NOT_AVAILABLE'});
});
test('provider is explicit and portal reports the configured model without changing tenant scope',()=>{
 assert.equal(classificationConfig({}).provider,'jev');assert.throws(()=>classificationConfig({ORBITA_AI_PROVIDER:'typo'}));
 const summary=presentAgentSummary({tenants:[{id:'tenant',agents:[{id:'channel',jevEnabled:true}]}]},{ORBITA_AI_PROVIDER:'openai'});
 assert.equal(summary.tenants[0].agents[0].model,MODEL);assert.equal(summary.tenants[0].id,'tenant');
 assert.equal(intentRequest('hola','Negocio').input.length,1);
});
test('a denied OpenAI budget prevents any provider request and preserves guided handling',async()=>{
 const env={ORBITA_AI_PROVIDER:'openai',ORBITA_CREDENTIAL_KEY:'ab'.repeat(32),ORBITA_OPENAI_API_KEY:'fixture'};
 const job={id:'fixture',tenantId:'tenant',channelId:'channel',tenantName:'Negocio',phoneNumberId:'123456789',connector:'human-review-v1',jevEnabled:true,
  message:{id:'wamid.fixture',body:'hola',from:'525500000001',receivedAt:new Date().toISOString()},credentials:await sealCredentials({metaAccessToken:'fixture'},env.ORBITA_CREDENTIAL_KEY,'tenant','channel')};
 let sent=0,reserved=false;const database={rpc:async(name)=>{if(name==='orbita_claim')return job;if(name==='orbita_reserve_openai_usage'){reserved=true;return false;}return null;}};
 assert.equal((await runOneJob(env,database,{fetcher:async(url)=>{assert(!String(url).includes('openai'));sent++;return Response.json({messages:[{id:'wamid.reply'}]});}})).status,'accepted');
 assert(reserved);assert.equal(sent,1);
});
test('platform reserves both token costs, settles once and denies public roles',async t=>{
 const f=await commerceFixture();t.after(()=>f.pg.close());await f.pg.exec('reset role');await f.pg.exec(await readFile(new URL('../orbita-database/openai-usage.sql',import.meta.url),'utf8'));await f.pg.exec('set role service_role');
 const {job,owner}=await f.receive('hola',{deferSend:true});const p={p_message_id:job.id,p_owner:owner,p_input_tokens:1000,p_output_tokens:512};
 await f.pg.query('update orbita.tenants set monthly_budget_usd=0.0006 where id=$1',[tenant]);
 assert.equal(await f.database.rpc('orbita_reserve_openai_usage',p),false);
 await f.pg.query('update orbita.tenants set monthly_budget_usd=1 where id=$1',[tenant]);
 await f.pg.query('update orbita.settings set monthly_budget_usd=0 where id=1');
 assert.equal(await f.database.rpc('orbita_reserve_openai_usage',p),false);
 await f.pg.query('update orbita.settings set monthly_budget_usd=null where id=1');
 assert.equal(await f.database.rpc('orbita_reserve_openai_usage',p),true);assert.equal(await f.database.rpc('orbita_reserve_openai_usage',p),false);
 let row=(await f.pg.query('select * from orbita.usage')).rows[0];assert.equal(Number(row.estimated_usd),.0012192);assert.equal(row.model,MODEL);
 await f.database.rpc('orbita_save_decision',{p_message_id:job.id,p_owner:owner,p_decision:{provider:'openai',model:MODEL,status:'classified',usage:{inputTokens:100,outputTokens:30}}});
 row=(await f.pg.query('select * from orbita.usage')).rows[0];assert.equal(Number(row.estimated_usd),.000088);assert.equal(row.verified,true);
 await f.database.rpc('orbita_save_decision',{p_message_id:job.id,p_owner:owner,p_decision:{usage:{inputTokens:9000,outputTokens:9000}}});
 assert.equal(Number((await f.pg.query('select estimated_usd from orbita.usage')).rows[0].estimated_usd),.000088);
 for(const role of ['anon','authenticated']){await f.pg.exec('set role '+role);await assert.rejects(f.pg.query('select public.orbita_reserve_openai_usage($1,$2,1000,512)',[job.id,owner]),/permission denied/);}
});
