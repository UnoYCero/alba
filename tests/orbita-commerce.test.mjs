import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture,tenant,channel,sender,otherTenant,accessCode} from '../scripts/commerce-fixture.mjs';
import {prepareCommerceReply,parseQuantity} from '../orbita-server/commerce.mjs';
import {createPortalHandler} from '../orbita-server/portal.mjs';
import {runOneJob} from '../orbita-server/engine.mjs';
async function setup(t){const f=await commerceFixture();t.after(()=>f.pg.close());return f;}
async function buy(f){
 assert.match((await f.receive('Quiero dos paquetes en CDMX',{intent:'pedido'})).reply,/nombre/);
 await f.receive('Cliente de prueba');await f.receive('recoger');await f.receive('sin extras');await f.receive('transferencia');
 assert.match((await f.receive('sí')).reply,/Solicitud .* enviada/);
 return (await f.store.list(tenant))[0];
}
test('natural purchase persists encrypted context, requires confirmation and survives a preparation retry',async t=>{
 const f=await setup(t);assert.equal(parseQuantity('quiero dos paquetes'),2);assert.equal(parseQuantity('quiero 21 paquetes'),null);
 await f.receive('Quiero dos paquetes en CDMX',{intent:'pedido'});await f.receive('Cliente ficticio');await f.receive('domicilio');
 await f.receive('Calle ficticia 10, Colonia de prueba');await f.receive('54080');await f.receive('Colonia de prueba');
 await f.receive('dos Guarnición de prueba');await f.receive('listo');const quoted=await f.receive('transferencia');assert.match(quoted.reply,/\$1440.00/);
 assert.equal((await f.store.list(tenant)).length,0);
 assert.match((await f.receive('No confirmo todavía')).reply,/responde «sí»/);
 const confirmed=await f.receive('sí',{deferSend:true});assert.match(confirmed.reply,/enviada/);
 const retried=await prepareCommerceReply(confirmed.job,{intent:'confirmar'},f.connector,f.database,confirmed.owner,{store:f.store});
 assert.equal(retried.reply,confirmed.reply);assert.equal((await f.store.list(tenant)).length,1);
 const raw=await f.pg.query('select state from orbita.commerce_sessions');
 const requests=await f.pg.query('select body from orbita.commerce_requests');
 for(const rows of [raw.rows,requests.rows])assert(!JSON.stringify(rows).includes('Calle ficticia'));
 await f.pg.exec('reset role;set role anon');await assert.rejects(f.pg.query('select * from orbita.commerce_requests'),/permission denied/);
});
test('changes require a new confirmation; closed historical menus never become orderable',async t=>{
 const f=await setup(t);await f.receive('quiero dos paquetes en CDMX',{intent:'pedido'});await f.receive('Nombre de prueba');await f.receive('recoger');await f.receive('sin extras');await f.receive('transferencia');
 f.setPrice(700);assert.match((await f.receive('sí')).reply,/cotización cambió/);assert.equal((await f.store.list(tenant)).length,0);
 assert.match((await f.receive('cambia a 3')).reply,/3 paquete/);assert.equal((await f.store.list(tenant)).length,0);
 await f.receive('cancelar');f.closeMenu();assert.match((await f.receive('quiero dos paquetes en CDMX',{intent:'pedido'})).reply,/no tiene un menú abierto/);
 assert.equal((await f.store.list(tenant)).length,0);
});
test('requests and sessions belong to the original tenant, channel and sender; held messages are preserved without response',async t=>{
 const f=await setup(t),request=await buy(f);
 assert.equal((await f.store.list(otherTenant)).length,0);
 assert.match((await f.receive('estado',{from:'525500000099'})).reply,/Todavía no tienes/);
 await assert.rejects(f.database.rpc('orbita_commerce_cancel',{p_tenant_id:otherTenant,p_request_id:request.id,p_revision:0}),/REVIEW_CONFLICT/);
 await f.database.rpc('orbita_commerce_hold',{p_tenant_id:tenant,p_channel_id:channel,p_sender:sender,p_held:true});
 const replyCount=f.replies.length;assert.equal((await f.receive('hola')).held,true);assert.equal(f.replies.length,replyCount);
 const rows=await f.store.conversations(tenant,channel);assert(rows.some(r=>r.message.body==='hola'&&r.needsHuman));
 const inbox=await f.store.inbox(tenant);assert(inbox.some(r=>r.message.body==='hola'&&r.held));
 assert.equal((await f.store.inbox(otherTenant)).length,0);
 assert((await f.store.conversations(tenant,channel,sender)).every(r=>r.message.from===sender));
 assert.equal((await f.store.conversations(otherTenant,channel)).length,0);
 await assert.rejects(f.database.rpc('orbita_commerce_hold',{p_tenant_id:otherTenant,p_channel_id:channel,p_sender:sender,p_held:false}),/CHANNEL_NOT_FOUND/);
});

test('an in-progress review cannot be taken over until its recovery window expires',async t=>{
 const f=await setup(t),r=await buy(f),owner=crypto.randomUUID();
 const review={reviewer:'demo',inventoryReviewed:true,paymentReviewed:true,paymentMethod:'transferencia',paymentReference:'fixture-proof'};
 const first=await f.store.reviewClaim(tenant,r.id,r.revision,owner,review);
 await assert.rejects(f.store.reviewClaim(tenant,r.id,first.revision,crypto.randomUUID(),review),/REVIEW_IN_PROGRESS/);
 await f.pg.query("update orbita.commerce_requests set updated_at=now()-interval '31 seconds' where id=$1",[r.id]);
 const recovered=await f.store.reviewClaim(tenant,r.id,first.revision,crypto.randomUUID(),{...review,paymentReference:'changed'});
 assert.equal(recovered.review.paymentReference,'fixture-proof');
});
async function portal(f,account='demo') {
 const handler=createPortalHandler({env:f.env,database:f.database,fetcher:f.fetcher,productionCheck:()=>true});
 const request=(path,body,session)=>new Request('https://albavision.tech/orbita/panel'+path,{method:body?'POST':'GET',headers:{
  ...(body?{'Content-Type':'application/json',Origin:'https://albavision.tech'}:{}),...(session?{Cookie:session.cookie,'X-Orbita-CSRF':session.csrf}:{})},body:body?JSON.stringify(body):undefined});
 const login=await handler(request('/session',{account,code:accessCode})),data=await login.json();
 assert.equal(login.status,200);const session={cookie:login.headers.get('set-cookie').split(';')[0],csrf:data.csrf};
 return {handler,request,session};
}
test('portal limits each identity to one tenant and rejects anonymous, cross-origin and forged CSRF actions',async t=>{
 const f=await setup(t);await buy(f);const p=await portal(f);
 assert.equal((await p.handler(p.request('/requests'))).status,403);
 const visible=await p.handler(p.request('/requests',null,p.session));assert.equal((await visible.json()).requests.length,1);
 const other=await portal(f,'other');assert.equal((await (await other.handler(other.request('/requests',null,other.session))).json()).requests.length,0);
 const bad=p.request('/hold',{channelId:channel,sender,held:true},{...p.session,csrf:'forged'});assert.equal((await p.handler(bad)).status,403);
 const cross=p.request('/session',{account:'demo',code:accessCode});cross.headers.set('origin','https://evil.test');assert.equal((await p.handler(cross)).status,403);
 const disabled=createPortalHandler({env:{...f.env,ORBITA_PORTAL_ENABLED:'false'},database:f.database,productionCheck:()=>true});assert.equal((await disabled(p.request(''))).status,404);
});
test('authenticated human review calls the idempotent business operation once; repeat cannot create a second order',async t=>{
 const f=await setup(t),r=await buy(f),p=await portal(f);
 const body={id:r.id,revision:r.revision,inventoryReviewed:true,paymentReviewed:true,paymentMethod:'transferencia',paymentReference:'fixture-bank-001'};
 assert.equal((await p.handler(p.request('/approve',{...body,paymentReviewed:false},p.session))).status,400);assert.equal(f.orders.size,0);
 const response=await p.handler(p.request('/approve',body,p.session));assert.equal(response.status,200);
 assert.equal(f.orders.size,1);assert.equal((await f.store.list(tenant))[0].status,'confirmed');
 assert.equal((await p.handler(p.request('/approve',body,p.session))).status,200);assert.equal(f.orders.size,1);
 assert.match((await f.receive('estado')).reply,/confirmado/);
});
test('unknown remote result keeps the immutable review and reference for reconciliation',async t=>{
 const f=await setup(t),r=await buy(f);let fail=true,calls=[];
 const original=f.fetcher;f.fetcher=async(url,opt)=>{calls.push(JSON.parse(opt.body));if(fail)throw new Error('uncertain');return original(url,opt)};
 const p=await portal(f),body={id:r.id,revision:0,inventoryReviewed:true,paymentReviewed:true,paymentMethod:'transferencia',paymentReference:'original-proof'};
 assert.equal((await p.handler(p.request('/approve',body,p.session))).status,409);
 const uncertain=(await f.store.list(tenant))[0];assert.equal(uncertain.status,'uncertain');fail=false;
 assert.equal((await p.handler(p.request('/approve',{...body,revision:uncertain.revision,paymentReference:'changed-proof'},p.session))).status,200);
 assert.equal(calls[0].reference,calls[1].reference);assert.equal(calls[1].review.paymentReference,'original-proof');assert.equal(f.orders.size,1);
});

test('panel operates with commerce disabled and cannot approve an order; paused legacy agent makes no provider call',async t=>{
 const f=await setup(t),r=await buy(f);f.env.ORBITA_COMMERCE_ENABLED='false';
 const p=await portal(f);const session=await (await p.handler(p.request('/session',null,p.session))).json();assert.equal(session.commerceEnabled,false);
 assert.equal((await p.handler(p.request('/inbox',null,p.session))).status,200);
 assert.equal((await p.handler(p.request('/approve',{id:r.id,revision:r.revision},p.session))).status,503);assert.equal(f.orders.size,0);
 await f.database.rpc('orbita_commerce_hold',{p_tenant_id:tenant,p_channel_id:channel,p_sender:sender,p_held:true});
 await f.database.rpc('orbita_ingest',{p_app_id:f.env.ORBITA_META_APP_ID,p_events:[{kind:'inbound',id:'wamid.panel-held',wabaId:'123456789',phoneNumberId:'123456789',from:sender,name:'Cliente ficticio',body:'¿Qué comida tienen?',mediaId:null,type:'text',receivedAt:new Date().toISOString()}]});
 let calls=0;const result=await runOneJob(f.env,f.database,{fetcher:async()=>{calls++;throw new Error('No provider allowed');}});
 assert.equal(result.status,'held');assert.equal(calls,0);
});
