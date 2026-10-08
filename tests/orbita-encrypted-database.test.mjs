import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createEncryptedDatabase} from '../orbita-server/encrypted-database.mjs';
import {createDatabase} from '../orbita-server/database.mjs';
import {createBlobState} from '../orbita-server/blob-state.mjs';
import {openCredentials,sealCredentials} from '../orbita-server/security.mjs';
import {runOneJob} from '../orbita-server/engine.mjs';
import {extractCoexistenceEvents} from '../orbita-server/webhook.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),channel=id(2),app='1782537496230918',phone='111111111',sender='525500000001';
const env={ORBITA_CREDENTIAL_KEY:'ab'.repeat(32),ORBITA_META_APP_ID:app};
const event=(provider='wamid.fixture')=>({kind:'inbound',id:provider,wabaId:phone,phoneNumberId:phone,from:sender,
  name:'Nombre privado ficticio',body:'Texto privado único ficticio',mediaId:null,type:'text',receivedAt:new Date().toISOString()});
async function fixture(t,http=false) {
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await pg.exec(await readFile(new URL('../orbita-database/schema.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../orbita-database/encrypted-cutover.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../orbita-database/coexistence.sql',import.meta.url),'utf8'));
  await pg.exec('set role service_role');
  const raw={rpc:async(name,p)=>{
    const entries=Object.entries(p);assert.match(name,/^orbita_[a-z_]+$/);
    const args=entries.map(([key],i)=>{assert.match(key,/^p_[a-z_]+$/);return `${key} => $${i+1}`;}).join(',');
    const values=entries.map(([key,value])=>['p_events','p_quote','p_decision','p_submission','p_delivery','p_snapshot'].includes(key)?JSON.stringify(value):
      key==='p_allowed' && value!==null?'{'+value.join(',')+'}':value);
    return (await pg.query(`select public.${name}(${args}) as result`,values)).rows[0].result;
  }};
  const voidFunctions=new Set(['orbita_handoff','orbita_prepare_reply','orbita_mark_sending','orbita_finish','orbita_fail_job','orbita_save_decision','orbita_submit_case','orbita_require_lease','orbita_configure_coexistence','orbita_coexistence_skip']);
  const transport=http?createDatabase({ORBITA_PROJECT_REF:'pfptagachuwclcxkmldb',ORBITA_SUPABASE_URL:'https://pfptagachuwclcxkmldb.supabase.co',ORBITA_SUPABASE_SECRET_KEY:'sb_secret_fixture'},async(url,options)=>{
    const name=new URL(url).pathname.split('/').at(-1),result=await raw.rpc(name,JSON.parse(options.body));
    return voidFunctions.has(name)?new Response(null,{status:204}):Response.json(result);
  }):raw;
  return {pg,raw,db:createEncryptedDatabase(env,fetch,transport)};
}
async function register(db) {
  await db.rpc('orbita_create_tenant',{p_id:tenant,p_slug:'fixture',p_name:'Negocio ficticio',p_budget:1});
  const credentials=await sealCredentials({metaAccessToken:'fixture-meta-token',tokenExpiresAt:0},env.ORBITA_CREDENTIAL_KEY,tenant,channel);
  await db.rpc('orbita_create_channel',{p_id:channel,p_tenant_id:tenant,p_app_id:app,p_waba_id:phone,p_phone_id:phone,p_connector:'human-review-v1',p_credentials:credentials,p_allowed:[sender],p_mode:'trial'});
  await db.rpc('orbita_activate_channel',{p_id:channel,p_credentials:credentials});
  await db.rpc('orbita_tenant_state',{p_id:tenant,p_paused:false});
}
test('PostgREST void responses preserve one send, recipient policy and encrypted provider delivery',async t=>{
  const {pg,db}=await fixture(t,true);await register(db);
  const incoming=event();
  assert.equal((await db.rpc('orbita_ingest',{p_app_id:app,p_events:[{...incoming,from:'525500000099'}]})).added,0);
  assert.equal((await db.rpc('orbita_ingest',{p_app_id:app,p_events:[{...incoming,from:'5215500000001'}]})).added,1);
  const stored=(await pg.query('select * from orbita.messages')).rows[0];
  for(const value of [incoming.body,incoming.name,sender]) assert.equal(JSON.stringify(stored).includes(value),false);
  let sent=0;
  const result=await runOneJob(env,db,{fetcher:async(url,options)=>{
    assert.match(url,/graph.facebook.com/);const request=JSON.parse(options.body);
    assert.equal(request.to,sender);assert.equal(request.context.message_id,incoming.id);sent++;
    return Response.json({messages:[{id:'wamid.outbound'}]});
  }});
  assert.equal(result.status,'accepted');assert.equal(sent,1);
  await db.rpc('orbita_ingest',{p_app_id:app,p_events:[{kind:'receipt',wabaId:phone,phoneNumberId:phone,id:'wamid.outbound',from:sender,status:'read'}]});
  assert.deepEqual((await db.rpc('orbita_status',{})).messages,{read:1});
  assert.equal((await db.rpc('orbita_ingest',{p_app_id:app,p_events:[incoming]})).added,0);
  assert.equal((await runOneJob(env,db,{fetcher:()=>{throw new Error('NO_RESEND');}})).processed,0);
  for(const role of ['anon','authenticated']) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(pg.query('select * from orbita.messages'),/permission denied/);
    await assert.rejects(pg.query("select public.orbita_import_snapshot('{}'::jsonb,repeat('a',64))"),/permission denied/);
  }
});

const manual=(provider='wamid.manual',recipient=sender)=>({kind:'manual',id:provider,wabaId:phone,phoneNumberId:phone,from:recipient,
  name:'',body:'Respuesta humana privada ficticia',mediaId:null,type:'text',receivedAt:new Date().toISOString()});
test('coexistence stores encrypted manual echoes, pauses only that conversation and opens production to other senders',async t=>{
  const {pg,db}=await fixture(t,true);await register(db);
  await pg.exec("update orbita.channels set mode='production',allowed_senders=null");
  await db.rpc('orbita_configure_coexistence',{p_channel_id:channel,p_business_phone:'525500000088'});
  const echo=manual();
  assert.equal((await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[{...echo,wabaId:'999999'}]})).added,0);
  assert.equal((await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[echo,echo]})).added,1);
  const stored=(await pg.query('select * from orbita.manual_messages')).rows[0];
  assert(!JSON.stringify(stored).includes(echo.body));assert(!JSON.stringify(stored).includes(sender));
  assert.equal((await db.rpc('orbita_ingest',{p_app_id:app,p_events:[event('wamid.held')]})).added,1);
  let sent=0;
  assert.deepEqual(await runOneJob(env,db,{fetcher:()=>{throw new Error('NO_LLM_OR_SEND_WHILE_HELD');}}),{processed:1,status:'held'});
  assert.equal((await db.rpc('orbita_ingest',{p_app_id:app,p_events:[{...event('wamid.other'),from:'525500000099'}]})).added,1);
  assert.equal((await runOneJob(env,db,{fetcher:async(_url,options)=>{
    assert.equal(JSON.parse(options.body).to,'525500000099');sent++;return Response.json({messages:[{id:'wamid.other.reply'}]});
  }})).status,'accepted');assert.equal(sent,1);
  await db.rpc('orbita_conversation_state',{p_channel_id:channel,p_sender:'525500000099',p_held:false});
  await db.rpc('orbita_ingest',{p_app_id:app,p_events:[{kind:'receipt',wabaId:phone,phoneNumberId:phone,id:'wamid.other.reply',from:'525500000099',status:'read'}]});
  assert.equal((await pg.query('select held from orbita.conversations where sender=$1',[await db.phoneIndex('525500000099')])).rows[0].held,false);
  await db.rpc('orbita_conversation_state',{p_channel_id:channel,p_sender:sender,p_held:false});
  assert.equal((await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[echo]})).added,0);
  const late={...manual('wamid.old-delayed'),receivedAt:new Date(Date.now()-60000).toISOString()};
  await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[late]});
  assert.equal((await pg.query('select held from orbita.conversations where sender=$1',[await db.phoneIndex(sender)])).rows[0].held,false);
  for (const role of ['anon','authenticated']) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(pg.query('select * from orbita.manual_messages'),/permission denied/);
    await assert.rejects(pg.query('select public.orbita_conversation_state($1,$2,false)',[channel,await db.phoneIndex(sender)]),/permission denied/);
  }
});

test('a manual answer arriving during reply preparation stops the final Meta call',async t=>{
  const {db,pg}=await fixture(t,true);await register(db);
  await db.rpc('orbita_configure_coexistence',{p_channel_id:channel,p_business_phone:'525500000088'});
  await db.rpc('orbita_ingest',{p_app_id:app,p_events:[event('wamid.race')]});
  const wrapped={rpc:async(name,p)=>{
    const result=await db.rpc(name,p);
    if(name==='orbita_prepare_reply') await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[manual()]});
    return result;
  }};
  assert.equal((await runOneJob(env,wrapped,{fetcher:()=>{throw new Error('MUST_NOT_SEND');}})).status,'held');
  const message=(await pg.query('select delivery,outbound_id,needs_human from orbita.messages')).rows[0];
  assert.equal(message.delivery,'expired');assert.equal(message.outbound_id,null);assert.equal(message.needs_human,true);
});

test('signed lifecycle events disable only the verified business-app channel',async t=>{
  const {db,pg}=await fixture(t);await register(db);
  await db.rpc('orbita_configure_coexistence',{p_channel_id:channel,p_business_phone:'525500000088'});
  const disconnect={kind:'disconnect',wabaId:phone,from:'525500000077',event:'PARTNER_REMOVED'};
  assert.equal((await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[disconnect]})).disconnected,0);
  assert.equal((await db.rpc('orbita_ingest_coexistence',{p_app_id:app,p_events:[{...disconnect,from:'525500000088'}]})).disconnected,1);
  assert.equal((await pg.query('select enabled from orbita.channels')).rows[0].enabled,false);
  assert.equal(await db.rpc('orbita_claim',{p_owner:id(7)}),null);
});

test('business-app echoes never become inbound jobs and unsupported history cannot trigger replies',()=>{
  const payload={object:'whatsapp_business_account',entry:[{id:phone,changes:[
    {field:'smb_message_echoes',value:{metadata:{phone_number_id:phone},message_echoes:[{id:'wamid.manual',from:'525500000088',to:sender,timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'Respuesta humana'}}]}},
    {field:'history',value:{messages:[{id:'old',from:sender}]}},
    {field:'account_update',value:{event:'ACCOUNT_OFFBOARDED'}}
  ]}]};
  const events=extractCoexistenceEvents(payload);assert.equal(events.length,2);assert.equal(events[0].kind,'manual');
  assert.equal(events[0].from,sender);assert.equal(events[1].kind,'disconnect');assert.equal(events[1].from,null);
});
test('encrypted unicode replies survive retry and a moved inbound ciphertext fails authentication',async t=>{
  const {pg,db,raw}=await fixture(t);await register(db);
  await db.rpc('orbita_ingest',{p_app_id:app,p_events:[event()]});
  const owner=id(3),job=await db.rpc('orbita_claim',{p_owner:owner});
  const reply='🌿'.repeat(2000);
  await db.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:reply});
  await db.rpc('orbita_fail_job',{p_message_id:job.id,p_owner:owner,p_sending:false});
  await pg.exec("update orbita.messages set next_attempt_at=now()-interval '1 second'");
  assert.equal((await db.rpc('orbita_claim',{p_owner:id(4)})).reply,reply);
  const stored=(await pg.query('select body from orbita.messages')).rows[0].body;
  await assert.rejects(openCredentials(stored,env.ORBITA_CREDENTIAL_KEY,'orbita-inbound-v1',`${app}:other:wamid.fixture`));
  await assert.rejects(raw.rpc('orbita_ingest',{p_app_id:app,p_events:[{...event('wamid.plaintext'),from:await db.phoneIndex(sender),name:''}]}),/check constraint|invalid input syntax/);
});
test('Blobs snapshot imports atomically, preserves read receipts and cannot overwrite later work',async t=>{
  let record=null,revision=0;
  const source=createBlobState({getWithMetadata:async()=>record,set:async(_key,data)=>{record={data,etag:String(++revision)};return {modified:true,etag:record.etag};}},env);
  await register(source);
  const incoming=event('wamid.migrated');await source.rpc('orbita_ingest',{p_app_id:app,p_events:[incoming]});
  const owner=id(5),job=await source.rpc('orbita_claim',{p_owner:owner});
  await source.rpc('orbita_save_case',{p_message_id:job.id,p_owner:owner,p_case_id:id(9),p_quote:{menuName:'Cotización privada ficticia',subtotalMxn:99}});
  await source.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:'Respuesta ya recibida'});
  await source.rpc('orbita_mark_sending',{p_message_id:job.id,p_owner:owner});
  await source.rpc('orbita_finish',{p_message_id:job.id,p_owner:owner,p_delivery:{status:'accepted',messageId:'wamid.previous',credentialRevision:1}});
  await source.rpc('orbita_ingest',{p_app_id:app,p_events:[{kind:'receipt',wabaId:phone,phoneNumberId:phone,id:'wamid.previous',from:sender,status:'read'}]});
  const snapshot=await openCredentials((await source.exportSnapshot()).ciphertext,env.ORBITA_CREDENTIAL_KEY,'orbita-platform','netlify-state-v1');
  const {pg,db,raw}=await fixture(t);const prepared=await db.prepareSnapshot(snapshot);
  for(const value of [incoming.body,incoming.name,sender,'Respuesta ya recibida','Cotización privada ficticia']) assert.equal(JSON.stringify(prepared).includes(value),false);
  const result=await raw.rpc('orbita_import_snapshot',{p_snapshot:prepared,p_digest:'a'.repeat(64)});
  assert.equal(result.counts.messages,1);assert.equal(result.counts.receipts,1);
  assert.deepEqual(await db.rpc('orbita_status',{}),await source.rpc('orbita_status',{}));
  assert.equal((await pg.query('select id from orbita.messages')).rows[0].id,job.id);
  assert.equal(await db.rpc('orbita_claim',{p_owner:id(6)}),null);
  await db.rpc('orbita_ingest',{p_app_id:app,p_events:[event('wamid.new')]});
  assert.equal((await raw.rpc('orbita_import_snapshot',{p_snapshot:prepared,p_digest:'a'.repeat(64)})).reused,true);
  assert.equal((await pg.query('select count(*)::int n from orbita.messages')).rows[0].n,2);
  await assert.rejects(raw.rpc('orbita_import_snapshot',{p_snapshot:prepared,p_digest:'b'.repeat(64)}),/ALREADY_IMPORTED/);
});
test('a failed import rolls back all rows and rejects a populated destination',async t=>{
  let record;const source=createBlobState({getWithMetadata:async()=>record,set:async(_key,data)=>{record={data,etag:'fixture'};return {modified:true,etag:'fixture'};}},env);
  await register(source);await source.rpc('orbita_ingest',{p_app_id:app,p_events:[event()]});
  const snapshot=await openCredentials(record.data,env.ORBITA_CREDENTIAL_KEY,'orbita-platform','netlify-state-v1');
  const {pg,db,raw}=await fixture(t);const prepared=await db.prepareSnapshot(snapshot);
  const invalid=structuredClone(prepared);invalid.messages[0].channel_id=id(99);
  await assert.rejects(raw.rpc('orbita_import_snapshot',{p_snapshot:invalid,p_digest:'c'.repeat(64)}),/foreign key/);
  assert.equal((await pg.query('select count(*)::int n from orbita.tenants')).rows[0].n,0);
  await register(db);
  await assert.rejects(raw.rpc('orbita_import_snapshot',{p_snapshot:prepared,p_digest:'d'.repeat(64)}),/DESTINATION_NOT_EMPTY/);
});
