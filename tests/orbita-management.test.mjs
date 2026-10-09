import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {commerceFixture,tenant,otherTenant,channel,accessCode,app,phone,sender} from '../scripts/commerce-fixture.mjs';
import {createPortalHandler} from '../orbita-server/portal.mjs';
async function fixture(t){const f=await commerceFixture();t.after(()=>f.pg.close());const accounts=JSON.parse(f.env.ORBITA_PORTAL_ACCOUNTS);accounts.push({id:'alba',name:'Alba Vision',role:'admin',accessHash:createHash('sha256').update(accessCode).digest('hex')});f.env.ORBITA_PORTAL_ACCOUNTS=JSON.stringify(accounts);return f}
async function client(f,account){const handler=createPortalHandler({env:f.env,database:f.database,productionCheck:()=>true});let cookie='',csrf='';const call=async(path,body)=>{const response=await handler(new Request('https://albavision.tech/orbita/panel'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,'X-Orbita-CSRF':csrf,...(body?{Origin:'https://albavision.tech','Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));const data=await response.json();return {response,data}};const login=await call('/session',{account,code:accessCode});assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];csrf=login.data.csrf;return {call,session:login.data}}
test('Alba sees all clients; a tenant cannot cross scope, assign budget, enable Jev or create clients',async t=>{
 const f=await fixture(t),admin=await client(f,'alba'),customer=await client(f,'demo');
 assert.equal(admin.session.role,'admin');assert.equal(customer.session.role,'tenant');
 assert.equal((await admin.call('/agents')).data.tenants.length,2);
 const own=(await customer.call('/agents')).data;assert.deepEqual(own.tenants.map(t=>t.id),[tenant]);assert.equal(own.tenants[0].agents.length,1);
 assert.equal(JSON.stringify(own).includes('synthetic-meta-token'),false);
 for(const [path,body] of [['/agents?tenant='+otherTenant,undefined],['/tenant-settings',{budgetUsd:999,paused:false}],['/clients',{name:'No',slug:'no',budgetUsd:1}],['/agent-state',{channelId:channel,enabled:true,jevEnabled:false}],['/agent-state',{tenantId:otherTenant,channelId:channel,enabled:false}]])assert.equal((await customer.call(path,body)).response.status,403,path);
 assert.equal((await admin.call('/tenant-settings',{tenantId:tenant,budgetUsd:2,paused:false})).response.status,200);
 assert.equal((await customer.call('/agents')).data.tenants[0].remainingUsd,2);
 assert.equal((await admin.call('/clients',{name:'Cliente nuevo',slug:'new-client',budgetUsd:5})).response.status,201);
 const all=(await admin.call('/agents')).data.tenants;const newClient=all.find(t=>t.slug==='new-client');assert.equal(newClient.paused,true);assert.deepEqual(newClient.agents,[]);
});
test('usage is monthly, scoped, includes reservations, and does not invent a message package',async t=>{
 const f=await fixture(t);await f.receive('hola');const row=(await f.pg.query('select id from orbita.messages')).rows[0];
 await f.pg.query("insert into orbita.usage(message_id,tenant_id,month,input_tokens,output_tokens,estimated_usd,verified) values($1,$2,to_char(now() at time zone 'America/Mexico_City','YYYY-MM'),100,20,0.25,false)",[row.id,tenant]);
 await f.database.rpc('orbita_management_tenant',{p_tenant_id:tenant,p_budget:1,p_paused:false,p_actor:'alba'});
 let own=(await f.database.rpc('orbita_management_summary',{p_tenant_id:tenant})).tenants[0];assert.equal(own.usedUsd,.25);assert.equal(own.remainingUsd,.75);assert.equal(own.calls,1);assert.equal(own.inputTokens,100);assert.equal(own.unverifiedCalls,1);
 assert.equal((await f.database.rpc('orbita_management_summary',{p_tenant_id:otherTenant})).tenants[0].usedUsd,0);
 await f.pg.query("update orbita.usage set month='2000-01'");own=(await f.database.rpc('orbita_management_summary',{p_tenant_id:tenant})).tenants[0];assert.equal(own.usedUsd,0);assert.equal(own.calls,0);
 await f.database.rpc('orbita_management_tenant',{p_tenant_id:tenant,p_budget:null,p_paused:false,p_actor:'alba'});assert.equal((await f.database.rpc('orbita_management_summary',{p_tenant_id:tenant})).tenants[0].remainingUsd,null);
});
test('client pause is audited, cannot activate invalid credentials and blocks a reply already prepared',async t=>{
 const f=await fixture(t),customer=await client(f,'demo');
 await f.database.rpc('orbita_ingest',{p_app_id:app,p_events:[{kind:'inbound',id:'management-pending',wabaId:phone,phoneNumberId:phone,from:sender,name:'Test',body:'hola',type:'text',receivedAt:new Date().toISOString()}]});
 const owner=crypto.randomUUID(),job=await f.database.rpc('orbita_claim',{p_owner:owner});await f.database.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:'Prueba'});
 assert.equal((await customer.call('/agent-state',{channelId:channel,enabled:false})).response.status,200);
 assert.equal(await f.database.rpc('orbita_commerce_begin_send',{p_message_id:job.id,p_owner:owner}),false);
 assert.equal((await f.pg.query('select delivery from orbita.messages where id=$1',[job.id])).rows[0].delivery,'pending');
 assert.equal((await f.pg.query('select actor from orbita.control_audit')).rows[0].actor,'demo');
 await f.pg.query('update orbita.channels set credentials_ready=false where id=$1',[channel]);
 assert.equal((await customer.call('/agent-state',{channelId:channel,enabled:true})).response.status,409);
 await f.pg.exec('reset role; set role anon');await assert.rejects(f.pg.query('select public.orbita_management_summary(null)'),/permission denied/);await assert.rejects(f.pg.query('select * from orbita.control_audit'),/permission denied/);
});
