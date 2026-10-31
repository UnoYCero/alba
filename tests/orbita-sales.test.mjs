import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {commerceFixture,tenant,otherTenant,channel,app,phone,sender} from '../scripts/commerce-fixture.mjs';
import {commerceStoreFor} from '../orbita-server/commerce.mjs';
import {prepareSalesReply,salesEnabled,salesAllowedForJob,paymentInstructions} from '../orbita-server/sales.mjs';
import {salesProfile,explicitCity,cityHint} from '../orbita-server/sales-profile.mjs';
import {MODEL} from '../orbita-server/openai.mjs';
import {menuImageReply,outboundReply,replyText} from '../orbita-server/reply-media.mjs';
import {runOneJob} from '../orbita-server/engine.mjs';
import {approvedTenantKnowledge} from '../orbita-server/sankalpa-knowledge.mjs';
const template=JSON.parse(await readFile(new URL('../config/sankalpa-sales-profile.example.json',import.meta.url),'utf8'));
test('Sankalpa FAQ is confined to its tenant',()=>{
 assert.match(approvedTenantKnowledge('53eefea1-ce35-4449-8d93-3ba510577b15').gluten,/celíacas/);
 assert.deepEqual(approvedTenantKnowledge(otherTenant),{});
});
async function fixture(t,{enabled=false,budget=null}={}){
 const f=await commerceFixture();t.after(()=>f.pg.close());await f.pg.exec('reset role');
 await f.pg.exec(await readFile(new URL('../orbita-database/openai-usage.sql',import.meta.url),'utf8'));await f.pg.exec('set role service_role');
 const profile=structuredClone(template);profile.capabilities={registration:enabled,orders:enabled,payments:enabled};
 if(enabled){profile.mode='production';profile.payments={bank:'Banco ficticio de prueba',holder:'Negocio ficticio',clabe:'000000000000000000',clipEnabled:true};}
 Object.assign(f.env,{ORBITA_SALES_ENABLED:'true',ORBITA_AI_PROVIDER:'openai',ORBITA_OPENAI_API_KEY:'synthetic-key',ORBITA_SALES_PROFILES:JSON.stringify({[tenant]:profile})});
 await f.pg.query('update orbita.tenants set monthly_budget_usd=$1 where id=$2',[budget,tenant]);
 await f.pg.query("update orbita.channels set mode='trial',allowed_senders=array[$1] where id=$2",[await f.database.phoneIndex(sender),channel]);
 const catalog={branches:profile.branches,menus:[{id:'menu-cdmx',branchId:'cdmx',name:'Menú Capital Ficticio',status:'abierto',priceMxn:660,dishIds:['dish-cdmx']},
  {id:'menu-merida',branchId:'merida',name:'Menú Sur Ficticio',status:'abierto',priceMxn:700,dishIds:['dish-merida']}],
  dishes:[{id:'dish-cdmx',name:'Guiso Capital Ficticio'},{id:'dish-merida',name:'Guiso Sur Ficticio'}]};
 const counts={planner:0,register:0,order:0,payment:0},inputs=[];
 const connector={catalog:async()=>catalog,extraOptions:async()=>[{id:'extra-fixture',name:'Ensalada adicional',priceMxn:30}],
  register:async()=>{counts.register++;return {customerId:'synthetic-customer'};},
  quote:async input=>({branchId:input.branchId,menuId:input.menuId,currency:'MXN',totalMxn:input.quantity*660+input.extras.reduce((s,e)=>s+e.quantity*30,0)+60,quoteRevision:'fixture-revision',input}),
  createOrder:async input=>{counts.order++;return {id:'synthetic-order',reference:input.reference,status:'pending_payment',totalMxn:input.quote.totalMxn};},
  paymentLink:async()=>{counts.payment++;return {url:'https://payclip.com/synthetic-payment'};}};
 const store=commerceStoreFor(f.database,f.env);let counter=0;
 async function turn(text,{topic='otro',slots={},mediaId=null,planner,finish=true}={}){
  const event={kind:'inbound',id:'wamid.sales.'+(++counter),wabaId:phone,phoneNumberId:phone,from:sender,name:'Synthetic contact',body:text,type:mediaId?'image':'text',mediaId,receivedAt:new Date().toISOString()};
  await f.database.rpc('orbita_ingest',{p_app_id:app,p_events:[event]});const owner=crypto.randomUUID(),job=await f.database.rpc('orbita_claim',{p_owner:owner});assert(job);
  const options={env:f.env,database:f.database,owner,connector,store,planner:async input=>{
   counts.planner++;inputs.push(structuredClone(input));if(planner)return planner(input);
   return {status:'classified',model:MODEL,provider:'openai',usage:{inputTokens:100,outputTokens:20},
    plan:{topic,reply:'',cityId:null,quantity:null,name:null,email:null,address:null,postalCode:null,...slots}};
  }};
  const result=await prepareSalesReply(job,options);
  if(finish&&!result.held){await f.database.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:result.reply});
   if(await f.database.rpc('orbita_commerce_begin_send',{p_message_id:job.id,p_owner:owner}))await f.database.rpc('orbita_finish',{p_message_id:job.id,p_owner:owner,p_delivery:{status:'accepted',messageId:'wamid.sales.reply.'+counter,credentialRevision:1}});}
  return {...result,job,owner,options};
 }
 return {...f,profile,catalog,connector,counts,inputs,turn,store};
}
test('city must be confirmed; the phone prefix is only a hint and the requested menu is remembered',async t=>{
 const f=await fixture(t);const first=await f.turn('¿Qué menú tienen?',{topic:'menu'});
 assert.match(first.reply,/ciudad|CDMX|entrega/);assert(!first.reply.includes('Menú Capital'));assert(!first.reply.includes('Mérida'));
 assert.equal(f.inputs[0].facts.menu,null);assert(!JSON.stringify(f.inputs[0]).includes('Guiso Sur'));
 // The synthetic sender has a CDMX prefix; yes confirms city, not a purchase.
 const next=await f.turn('sí',{topic:'confirmar'});assert.match(next.reply,/Menú Capital Ficticio/);assert(!next.reply.includes('Menú Sur'));
 assert(!next.reply.includes('nombre'));assert.equal(f.counts.register,0);
});
test('explicit Merida wins over a CDMX phone prefix and only its menu reaches the model',async t=>{
 const f=await fixture(t);const result=await f.turn('Estoy en Mérida, ¿qué menú tienen?',{topic:'menu'});
 assert.match(result.reply,/Menú Sur Ficticio/);assert(!result.reply.includes('Menú Capital'));
 assert(!JSON.stringify(f.inputs[0]).includes('Guiso Capital'));assert.equal(f.inputs[0].facts.branch.id,'merida');
});
test('FAQ interruptions answer without forcing the pending registration field',async t=>{
 const f=await fixture(t);assert.match((await f.turn('En CDMX quiero dos paquetes',{topic:'comprar'})).reply,/continuar/);
 assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/nombre/);
 const faq=await f.turn('¿Cómo se realizan los pagos?',{topic:'pago'});assert.match(faq.reply,/transferencia/i);assert(!faq.reply.includes('nombre'));
 assert(!faq.reply.includes('llamar'));assert(!faq.reply.includes('sankalpa pedido'));
 assert.match((await f.turn('Cliente Ficticio',{topic:'datos'})).reply,/correo/);
});
test('weekly duration is not silently treated as number of packages',async t=>{
 const f=await fixture(t);await f.turn('CDMX quiero pedir',{topic:'comprar'});
 assert.match((await f.turn('Para toda la semana')).reply,/semana/);
 assert.match((await f.turn('7')).reply,/7 paquetes o a 7 días/);
 assert.match((await f.turn('días')).reply,/Cuántos paquetes/);
 assert.match((await f.turn('dos paquetes',{topic:'cantidad'})).reply,/continuar/);
});
test('buying interest can start with a helpful question instead of demanding a package count',async t=>{
 const f=await fixture(t);const result=await f.turn('CDMX quiero comida para la semana',{topic:'comprar',slots:{reply:'¡Con gusto! ¿La comida sería para ti o para más personas?'}});
 assert.match(result.reply,/más personas/);assert(!result.reply.includes('correo'));assert.equal(f.counts.register,0);
 assert.match((await f.turn('7')).reply,/7 personas, días o paquetes/);
});
test('ambiguous name, explicit correction, denial and frustration receive useful replies',async t=>{
 const f=await fixture(t);await f.turn('CDMX quiero dos paquetes',{topic:'comprar'});await f.turn('sí',{topic:'confirmar'});
 const ambiguous=await f.turn('Mio',{topic:'datos',slots:{name:'Mio'}});assert.match(ambiguous.reply,/cuál es tu nombre/);
 await f.turn('Cliente Ficticio',{topic:'datos'});await f.turn('cliente@example.invalid',{topic:'datos'});
 await f.turn('Calle Ficticia 10, Colonia de Prueba',{topic:'datos'});await f.turn('54080',{topic:'datos'});
 const corrected=await f.turn('Mi nombre es Alan, no Mio',{topic:'datos'});assert.match(corrected.reply,/actualicé el nombre/);
 assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/para Alan/);
 const denied=await f.turn('No');assert.match(denied.reply,/no confirmaré/);
 assert.match((await f.turn('mejor quiero tres paquetes',{topic:'comprar'})).reply,/3 paquete/);
 assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/3 paquete/);
 assert.match((await f.turn('😠')).reply,/Perdón/);
 const {job,owner}=await f.turn('ya te lo dije',{finish:false});
 assert.match((await f.store.context(job,owner)).state.sales.customer.name,/^Alan$/);
 assert.equal(f.counts.register,0);
});
async function collect(f){
 await f.turn('CDMX quiero dos paquetes',{topic:'comprar'});
 await f.turn('sí',{topic:'confirmar'});
 await f.turn('Cliente Ficticio',{topic:'datos'});await f.turn('cliente@example.invalid',{topic:'datos'});
 await f.turn('Calle Ficticia 10, Colonia de Prueba',{topic:'datos'});await f.turn('54080',{topic:'datos'});
}
test('natural replies answer a new question without repeating the sales form or making an operation',async t=>{
 const f=await fixture(t);await f.turn('CDMX quiero dos paquetes',{topic:'comprar'});
 const question=await f.turn('¿Cómo funciona el servicio?',{topic:'funcionamiento',slots:{reply:'Preparamos comida semanal en paquetes. ¿La comida sería para ti o para más personas?'}});
 assert.match(question.reply,/más personas/);assert(!question.reply.includes('registro'));assert.equal(f.counts.register,0);
 const greeting=await f.turn('Hola',{slots:{reply:'¡Hola de nuevo! ¿Qué te gustaría saber?'}});assert.match(greeting.reply,/Hola de nuevo/);
 const {job,owner}=await f.turn('todavía no',{finish:false});
 assert.match((await f.store.context(job,owner)).state.sales.stage,/^discovery$/);
});
test('untrusted generated amounts and external links are rejected in FAQ replies',async t=>{
 const f=await fixture(t);const result=await f.turn('CDMX ¿cómo funciona?',{topic:'funcionamiento',slots:{reply:'Cuesta 999999 pesos, paga en https://invalid.example.'}});
 assert(!result.reply.includes('999999'));assert(!result.reply.includes('https:'));assert.match(result.reply,/comida semanal/);
});
test('a yes after an interruption cannot authorize registration or an order',async t=>{
 const f=await fixture(t);await f.turn('CDMX quiero dos paquetes',{topic:'comprar'});
 await f.turn('¿Cómo funciona?',{topic:'funcionamiento',slots:{reply:'Preparamos comida semanal en paquetes. ¿Es para ti?'}});
 const ambiguous=await f.turn('sí',{topic:'confirmar'});assert.match(ambiguous.reply,/continuar con ellos/);assert.equal(f.counts.register,0);
 assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/nombre/);
});
test('greeting at final confirmation does not confirm a registration',async t=>{
 const f=await fixture(t);await collect(f);
 const greeting=await f.turn('Hola',{slots:{reply:'¡Hola de nuevo! ¿En qué te puedo ayudar?'}});
 assert.match(greeting.reply,/Hola de nuevo/);assert(!greeting.reply.includes('Confirmas'));
 const next=await f.turn('sí',{topic:'confirmar'});assert.match(next.reply,/Confirmas estos datos/);assert.equal(f.counts.register,0);
});
test('generated reply cannot introduce another city or unapproved payment claims',async t=>{
 const f=await fixture(t);const result=await f.turn('CDMX ¿cómo funciona?',{topic:'funcionamiento',slots:{reply:'En Mérida te damos entrega gratis.'}});
 assert(!result.reply.includes('Mérida'));assert(!result.reply.includes('gratis'));assert.match(result.reply,/comida semanal/);
});
test('generated conversation cannot solicit registration data before permission',async t=>{
 const f=await fixture(t);const result=await f.turn('CDMX ¿cómo funciona?',{topic:'funcionamiento',slots:{reply:'Cuéntame, ¿cuál es tu correo para comenzar?'}});
 assert(!result.reply.includes('correo'));assert.match(result.reply,/comida semanal/);assert.equal(f.counts.register,0);
});
test('catalog outage does not prevent answering an unrelated service question',async t=>{
 const f=await fixture(t);f.connector.catalog=async()=>{throw Error('unavailable');};
 assert.match((await f.turn('CDMX ¿cómo funciona?',{topic:'funcionamiento'})).reply,/comida semanal/);
 assert.match((await f.turn('¿Qué menú tienen?',{topic:'menu'})).reply,/no pude consultar/i);
});
test('approved FAQ answers gluten safety, weekly menu and the salad exception without changing an order',async t=>{
 const f=await fixture(t);
 const gluten=await f.turn('¿Es apta para celíacos?',{topic:'duda'});assert.match(gluten.reply,/No somos un servicio apto/);assert.match(gluten.reply,/ciudad|CDMX/);
 const salad=await f.turn('En CDMX, ¿puedo cambiar la ensalada por sopa?',{topic:'quitar_platillo'});
 assert.match(salad.reply,/lunes/);assert.match(salad.reply,/equipo debe revisar/);assert.equal(f.counts.order,0);
 const weekly=await f.turn('¿El menú cambia cada semana?',{topic:'menu'});assert.match(weekly.reply,/cambia cada semana/);assert(!weekly.reply.includes('Menú Sur'));
});
test('approved FAQ answers pickup, ingredient changes and macros without inventing an address',async t=>{
 const f=await fixture(t);
 const pickup=await f.turn('CDMX ¿Puedo recoger mi pedido?',{topic:'ubicacion'});assert.match(pickup.reply,/domingos de 5 a 6/);assert.match(pickup.reply,/dirección exacta está pendiente/);
 const ingredients=await f.turn('¿Puedo cambiar algún ingrediente?',{topic:'quitar_platillo'});assert.match(ingredients.reply,/miércoles/);
 const macros=await f.turn('¿Hacen conteo de macros?',{topic:'duda'});assert.match(macros.reply,/No ofrecemos/);
});
test('after a pickup question the agent offers the selected city menu and treats yes only as a menu request',async t=>{
 const f=await fixture(t);const pickup=await f.turn('CDMX ¿Puedo recoger mi pedido?',{topic:'ubicacion'});
 assert.match(pickup.reply,/domingos de 5 a 6/);assert.match(pickup.reply,/conocer el menú de CDMX/);
 const menu=await f.turn('sí',{topic:'confirmar'});assert.match(menu.reply,/Menú Capital Ficticio/);assert(!menu.reply.includes('Menú Sur'));
 assert.equal(f.counts.register,0);assert.equal(f.counts.order,0);
 assert.match(menu.reply,/preparar una selección/);
 assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/Cuántos paquetes/);
 const count=await f.turn('2',{topic:'cantidad'});assert.match(count.reply,/continuar con ellos/);assert.equal(f.counts.register,0);
});
test('declining a menu suggestion is respected and never treated as purchase consent',async t=>{
 const f=await fixture(t);await f.turn('CDMX ¿Puedo recoger mi pedido?',{topic:'ubicacion'});
 assert.match((await f.turn('No gracias')).reply,/sin problema/);
 const answer=await f.turn('¿Es vegetariana?',{topic:'duda'});assert(!answer.reply.includes('conocer el menú'));
 assert.equal(f.counts.register,0);assert.equal(f.counts.order,0);
});
test('food safety questions and their follow-up do not trigger a sales suggestion',async t=>{
 const f=await fixture(t);const gluten=await f.turn('CDMX ¿Es apta para celíacos?',{topic:'duda'});
 assert.match(gluten.reply,/No somos un servicio apto/);assert(!gluten.reply.includes('conocer el menú'));
 const pickup=await f.turn('¿Puedo recoger mi pedido?',{topic:'ubicacion'});assert(!pickup.reply.includes('conocer el menú'));
 for(let i=0;i<4;i++)assert(!/conocer los paquetes|preparar una selección/i.test((await f.turn('Hola')).reply));
 const injected=await f.turn('¿Cómo funciona?',{topic:'funcionamiento',slots:{reply:'Preparamos comida semanal. ¿Quieres comprar un paquete?'}});
 assert(!/comprar un paquete/i.test(injected.reply));
});
test('a menu suggestion in a pending confirmation never counts as registration or order consent',async t=>{
 const f=await fixture(t);await collect(f);
 const question=await f.turn('¿Puedo recoger mi pedido?',{topic:'ubicacion'});assert.match(question.reply,/conocer el menú/);
 const menu=await f.turn('sí',{topic:'confirmar'});assert.match(menu.reply,/Menú Capital/);assert.equal(f.counts.register,0);assert.equal(f.counts.order,0);
 assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/Confirmas estos datos/);assert.equal(f.counts.register,0);
});
test('an untracked model suggestion cannot make an ambiguous yes start a purchase',async t=>{
 const f=await fixture(t);const first=await f.turn('CDMX hola',{slots:{reply:'¿Quieres comprar un paquete?'}});
 assert.match(first.reply,/conocer el menú/);assert(!first.reply.includes('comprar un paquete'));
 const answer=await f.turn('sí',{topic:'confirmar'});assert.match(answer.reply,/Menú Capital/);assert(!answer.reply.includes('Cuántos paquetes'));
 assert.equal(f.counts.register,0);assert.equal(f.counts.order,0);
});
test('actual requests to remove a dish still go to human review',async t=>{
 const f=await fixture(t);const result=await f.turn('Quiero quitar un platillo del paquete');
 assert.match(result.reply,/Diana/);assert.equal((await f.pg.query('select needs_human from orbita.messages where id=$1',[result.job.id])).rows[0].needs_human,true);
});
test('pending configuration collects consent but never invents a registration, order, bank or payment link',async t=>{
 const f=await fixture(t);await collect(f);const result=await f.turn('sí',{topic:'confirmar'});
 assert.match(result.reply,/pendientes|pendiente/);assert.match(result.reply,/no creé/);assert.deepEqual([f.counts.register,f.counts.order,f.counts.payment],[0,0,0]);
 assert(!paymentInstructions(f.profile).includes('CLABE:'));assert(!result.reply.includes('https://'));
 const raw=JSON.stringify((await f.pg.query('select decision,body from orbita.messages')).rows);
 assert(!raw.includes('cliente@example.invalid'));assert(!raw.includes('Calle Ficticia'));assert(!raw.includes('Cliente Ficticio'));
 const usage=(await f.pg.query('select model,verified from orbita.usage')).rows;assert(usage.length);assert(usage.every(u=>u.model===MODEL&&u.verified));
});
test('complete isolated route registers once, adds dishes, confirms a quote, issues a pending ticket and escalates proof',async t=>{
 const f=await fixture(t,{enabled:true});await collect(f);assert.match((await f.turn('sí',{topic:'confirmar'})).reply,/adicional/);assert.equal(f.counts.register,1);
 assert.match((await f.turn('dos Ensalada adicional',{topic:'comprar'})).reply,/2 de/);
 const quote=await f.turn('listo');assert.match(quote.reply,/1,440/);assert.equal(f.counts.order,0);
 const order=await f.turn('sí',{topic:'confirmar'});assert.match(order.reply,/Ticket/);assert.match(order.reply,/pendiente de pago/);assert.match(order.reply,/CLABE: 000000000000000000/);assert.equal(f.counts.order,1);
 assert.match((await f.turn('Prefiero Clip',{topic:'pago'})).reply,/https:\/\/payclip.com/);assert.equal(f.counts.payment,1);
 const proof=await f.turn('Comprobante de prueba',{mediaId:'synthetic-proof'});assert.match(proof.reply,/Diana/);assert.match(proof.reply,/antes de confirmar/);
 assert.equal((await f.pg.query('select needs_human from orbita.messages where id=$1',[proof.job.id])).rows[0].needs_human,true);
 assert.equal(f.counts.order,1);
});
test('removing a package dish requests review without calling AI or modifying the basket',async t=>{
 const f=await fixture(t);const result=await f.turn('Quiero quitar un platillo del paquete',{topic:'comprar'});
 assert.match(result.reply,/Diana/);assert.equal(f.counts.planner,0);assert.equal(f.counts.order,0);
});
test('a failed external registration is not repeated; the reference remains for human reconciliation',async t=>{
 const f=await fixture(t,{enabled:true});await collect(f);f.connector.register=async()=>{f.counts.register++;throw Error('uncertain');};
 const result=await f.turn('sí',{topic:'confirmar',finish:false});assert.match(result.reply,/No pude comprobar/);assert.equal(f.counts.register,1);
 const retry=await prepareSalesReply(result.job,result.options);assert.equal(retry.reply,result.reply);assert.equal(f.counts.register,1);
});
test('a prepared reply and decision survive a retry without another provider reservation',async t=>{
 const f=await fixture(t);const first=await f.turn('CDMX ¿qué menú tienen?',{topic:'menu',finish:false});
 const count=f.counts.planner;const retry=await prepareSalesReply(first.job,first.options);assert.equal(retry.reply,first.reply);assert.equal(f.counts.planner,count);
 assert.equal(Number((await f.pg.query('select count(*) n from orbita.usage')).rows[0].n),1);
});
test('an exhausted budget keeps city guidance and makes no AI call',async t=>{
 const f=await fixture(t,{budget:0});const result=await f.turn('¿Qué menú tienen?',{topic:'menu'});assert.match(result.reply,/entrega/);assert.equal(f.counts.planner,0);
});
test('tenant profiles have no cross-tenant fallback and model-invented personal data is ignored',async t=>{
 const f=await fixture(t);assert(salesEnabled(f.env,tenant));assert.equal(salesEnabled(f.env,otherTenant),false);
 await f.turn('CDMX quiero dos paquetes',{topic:'comprar',slots:{name:'Inventado',email:'stolen@example.invalid'}});
 const {job,owner}=await f.turn('¿Cómo funciona?',{topic:'funcionamiento',finish:false});const state=(await f.store.context(job,owner)).state.sales;
 assert.equal(state.customer.name,undefined);assert.equal(state.customer.email,undefined);
 assert.equal(explicitCity('CDMX y Mérida',f.profile.branches),null);assert.equal(cityHint('529991234567',f.profile.branches),'merida');
 assert.throws(()=>salesProfile({...f.env,ORBITA_SALES_PROFILES:'invalid'},tenant));
});
test('approved image is sent only for the selected menu; absent or mismatched images remain text',async t=>{
 const f=await fixture(t);f.profile.branches[0].menuImage={menuId:'menu-cdmx',url:'https://example.com/synthetic-menu.png'};
 f.env.ORBITA_SALES_PROFILES=JSON.stringify({[tenant]:f.profile});
 const result=await f.turn('CDMX ¿qué menú tienen?',{topic:'menu'});const message=outboundReply(result.reply);
 assert.equal(message.type,'image');assert.match(message.image.caption,/Menú Capital/);assert(!message.image.caption.includes('Menú Sur'));
 assert.equal(replyText(result.reply),message.image.caption);
 assert.equal(outboundReply(menuImageReply('http://example.com/image.png','Menu')).type,'text');
 assert.throws(()=>outboundReply('ORBITA_IMAGE_V1\n{}'));
});
test('worker integrates conversation, metering, encrypted outbox and one provider send',async t=>{
 const f=await fixture(t);const event={kind:'inbound',id:'wamid.worker-sales',wabaId:phone,phoneNumberId:phone,from:sender,name:'Synthetic contact',body:'¿Cómo funciona?',type:'text',receivedAt:new Date().toISOString()};
 await f.database.rpc('orbita_ingest',{p_app_id:app,p_events:[event]});let ai=0,sends=0;const requests=[];
 const result=await runOneJob(f.env,f.database,{fetcher:async(url,options)=>{
  if(String(url)==='https://api.openai.com/v1/responses'){
   ai++;const request=JSON.parse(options.body);requests.push({kind:'ai',request});
   return Response.json({id:'resp_fixture',status:'completed',model:MODEL,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({topic:'funcionamiento',reply:'Preparamos comida semanal en paquetes.',cityId:null,quantity:null,name:null,email:null,address:null,postalCode:null})}]}],usage:{input_tokens:100,output_tokens:30}});
  }
  assert.match(String(url),/^https:\/\/graph.facebook.com/);sends++;const message=JSON.parse(options.body);requests.push({kind:'send',message});return Response.json({messages:[{id:'wamid.worker-reply'}]});
 }});
 assert.equal(result.status,'accepted');assert.equal(ai,1);assert.equal(sends,1);
 assert.equal(requests[0].request.store,false);assert.equal(requests[0].request.text.format.name,'orbita_sales_turn');assert.match(requests[1].message.text.body,/comida semanal/);
 const row=(await f.pg.query('select delivery,reply,decision from orbita.messages')).rows[0];assert.equal(row.delivery,'accepted');assert(!row.reply.includes('comida semanal'));assert(row.decision.salesPlan);
 assert.equal((await f.pg.query('select verified from orbita.usage')).rows[0].verified,true);
});
test('declining the phone-prefix hint asks an open city question instead of repeating the suggestion',async t=>{
 const f=await fixture(t);await f.turn('¿Qué menú tienen?',{topic:'menu'});
 const declined=await f.turn('no');assert.match(declined.reply,/En qué ciudad/);assert(!declined.reply.includes('CDMX'));
 const next=await f.turn('Mérida',{topic:'ubicacion'});assert.match(next.reply,/Menú Sur/);assert(!next.reply.includes('Menú Capital'));
});
test('test profile cannot enable real writes or run on a production WhatsApp channel',async t=>{
 const f=await fixture(t,{enabled:true});f.profile.mode='test';f.env.ORBITA_SALES_PROFILES=JSON.stringify({[tenant]:f.profile});
 await collect(f);await f.turn('sí',{topic:'confirmar'});assert.equal(f.counts.register,0);
 assert.equal(await salesAllowedForJob(f.env,{tenantId:tenant,channelId:channel},f.database),true);
 await f.pg.query("update orbita.channels set mode='production',allowed_senders=null where id=$1",[channel]);
 assert.equal(await salesAllowedForJob(f.env,{tenantId:tenant,channelId:channel},f.database),false);
});
