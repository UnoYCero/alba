import {canonicalPhone,sealCredentials,openCredentials} from './security.mjs';
import {salesProfile,normalize,explicitCity,cityQuestion,cityHint,publicSalesFacts} from './sales-profile.mjs';
import {planSales,salesRequest} from './sales-openai.mjs';
import {MODEL,MAX_OUTPUT_TOKENS} from './openai.mjs';
import {parseQuantity} from './commerce.mjs';
import {menuImageReply,replyText} from './reply-media.mjs';
const yes=text=>/^(si|si quiero|si por favor|correcto|correctos|confirmo|acepto|adelante|de acuerdo)[.!\s]*$/.test(normalize(text));
const money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value)+' MXN';
const faqTopics=new Set(['funcionamiento','pago','ubicacion','cobertura','precio','menu','duda']);
function fallbackPlan(text){
 const t=normalize(text);let topic='otro';
 for(const [key,re] of [['humano',/^(?:por favor )?(?:quiero |necesito |puedo )?(?:hablar con (?:diana|una persona|un humano|un asesor)|un asesor|un humano|ayuda de diana|llama a diana)[.!?\s]*$/],['quitar_platillo',/\b(quitar|eliminar|omitir|sin)\b.*\b(platillo|paquete|sopa|guisado)\b/],['cancelar',/^(cancelar|cancela)$/],['ubicacion',/donde|ubicad|direccion|ubicacion/],['cobertura',/cobertura|colonia|envio|entregan en/],['precio',/precio|cuanto cuesta|cuanto vale/],['menu',/menu|comida tienen|que tienen/],['funcionamiento',/como funciona|que incluye|porciones|personas/],['pago',/pagar|pago|transferencia|clip|clabe/],['comprar',/quiero|comprar|pedir|paquetes/]])if(re.test(t)){topic=key;break;}
 return {topic,quantity:parseQuantity(text),reply:''};
}
function supportedReply(reply,facts){
 if(typeof reply!=='string'||!reply.trim()||reply.length>1600||/[?¿]/.test(reply)||/https?:|\b(?:registr[eé]|confirmado|pagado|ya avis[eé]|ya llam[eé])\b/i.test(reply))return null;
 const source=JSON.stringify(facts);
 if((reply.match(/\d+(?:[.,]\d+)*/g)||[]).some(n=>!source.includes(n)))return null;
 return reply.trim();
}
function menuFor(catalog,branchId){
 const rows=catalog.menus.filter(m=>m.branchId===branchId&&Number.isFinite(m.priceMxn)&&m.priceMxn>0);
 return rows.find(m=>m.status==='abierto')||[...rows].sort((a,b)=>String(b.startsAt||'').localeCompare(String(a.startsAt||'')))[0]||null;
}
function safeField(value,text,max){return typeof value==='string'&&value.trim().length>=2&&value.length<=max&&normalize(text).includes(normalize(value))?value.trim():null;}
export function salesEnabled(env,tenantId){return env.ORBITA_SALES_ENABLED==='true'&&env.ORBITA_AI_PROVIDER==='openai'&&!!salesProfile(env,tenantId);}
export async function salesAllowedForJob(env,job,database){
 if(!salesEnabled(env,job.tenantId))return false;
 if(salesProfile(env,job.tenantId).mode!=='test')return true;
 const channel=await database.rpc('orbita_operator_channel',{p_id:job.channelId});
 return channel?.tenantId===job.tenantId&&channel.mode==='trial';
}
export async function prepareSalesReply(job,{env,database,owner,connector,store,fetcher=fetch,planner=planSales,clock=Date.now}={}){
 const profile=salesProfile(env,job.tenantId);if(!profile)return null;
 const context=await store.context(job,owner);if(context.held){await database.rpc('orbita_commerce_skip',{p_message_id:job.id,p_owner:owner});return {held:true};}
 let revision=context.revision;const all=structuredClone(context.state),state=all.sales||{stage:'discovery',customer:{},extras:[],history:[],operations:{}};
 all.sales=state;const text=job.message.body?.trim()||'',t=normalize(text);
 if(state.lastMessageId===job.message.id&&state.lastReply)return {reply:state.lastReply};
 const persist=async()=>{await store.commit(job,owner,revision,all);revision++;};
 const save=async reply=>{
  state.lastMessageId=job.message.id;state.lastReply=reply;
  state.history=[...state.history,{role:'user',text:text.slice(0,700)},{role:'assistant',text:replyText(reply).slice(0,700)}].slice(-6);
  await persist();return {reply};
 };
 const handoff=async(reason,reply)=>{state.review={reason,messageId:job.message.id,requestedAt:new Date(clock()).toISOString()};
  state.stage='review';await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});return save(reply);};
 // Outbound text and personal slots live only in encrypted session/plan storage.
 if(job.message.mediaId)return handoff('payment_proof','Recibí tu archivo. Diana debe revisar el comprobante antes de confirmar el pago y el pedido. La conversación quedó marcada para revisión.');
 const early=fallbackPlan(text);
 if(early.topic==='humano')return handoff('customer_request','Tu conversación quedó marcada para atención de la persona responsable. Conservamos lo que ya nos compartiste para que pueda continuar contigo.');
 if(early.topic==='quitar_platillo')return handoff('package_change',`Los paquetes conservan todos sus platillos. Marqué tu solicitud para que ${profile.ownerName||'la persona responsable'} revise esa excepción antes de cambiarlo.`);
 let cityJustSelected=false;
 const fromText=explicitCity(text,profile.branches);
 if(fromText&&fromText!==state.cityId){
  if(state.cityId&&Object.keys(state.operations).length)return handoff('city_change_after_operation','Para cambiar la ciudad de una operación ya iniciada, la persona responsable debe revisarla. Conservé la referencia para evitar duplicar el pedido.');
  state.cityId=fromText;state.stage='discovery';state.extras=[];delete state.quote;delete state.menuId;delete state.quantity;
  state.history=[];
  cityJustSelected=true;
  delete state.customer.address;delete state.customer.postalCode;delete state.pendingCityHint;
 }
 if(!state.cityId&&state.pendingCityHint&&yes(text)){state.cityId=state.pendingCityHint;delete state.pendingCityHint;cityJustSelected=true;}
 else if(!state.cityId&&/^(no|otra ciudad)[.!]*$/.test(t)){delete state.pendingCityHint;state.rejectedCityHint=true;}
 let catalog={menus:[],dishes:[],branches:[]};
 if(state.cityId){try{catalog=await connector.catalog();}catch{return save('En este momento no pude consultar el menú. Conservé lo que llevamos y puedes volver a preguntarme en un momento.');}}
 const menu=state.cityId?menuFor(catalog,state.cityId):null;
 const branch=profile.branches.find(b=>b.id===state.cityId);
 const facts={...publicSalesFacts(profile,state.cityId),menu:menu?{id:menu.id,name:menu.name,priceMxn:menu.priceMxn,status:menu.status,
  dishes:(menu.dishIds||[]).map(id=>catalog.dishes.find(d=>d.id===id)?.name).filter(Boolean)}:null};
 let plan,decision=job.decision;
 if(decision?.salesPlan)plan=await openCredentials(decision.salesPlan,env.ORBITA_CREDENTIAL_KEY,'orbita-sales-plan-v1',job.id);
 if(!plan){
  const input={facts,stage:state.stage,cityId:state.cityId||null,history:state.history,message:text};
  let estimate=new TextEncoder().encode(JSON.stringify(salesRequest(input))).length+2048;
  if(estimate>20000){input.history=[];estimate=new TextEncoder().encode(JSON.stringify(salesRequest(input))).length+2048;}
  const reserve=job.jevEnabled&&estimate<=20000&&!decision&&await database.rpc('orbita_reserve_openai_usage',{
   p_message_id:job.id,p_owner:owner,p_input_tokens:estimate,p_output_tokens:MAX_OUTPUT_TOKENS});
  if(reserve){
   let result;try{result=await planner(input,env.ORBITA_OPENAI_API_KEY,fetcher);}catch{result={status:'unavailable',provider:'openai',model:MODEL};}
   plan=result.plan||fallbackPlan(text);
   decision={status:result.status,provider:'openai',model:MODEL,intent:plan.topic==='menu'?'menu':'otro',routable:true,
    ...(result.usage?{usage:result.usage}:{}),salesPlan:await sealCredentials(plan,env.ORBITA_CREDENTIAL_KEY,'orbita-sales-plan-v1',job.id)};
   await database.rpc('orbita_save_decision',{p_message_id:job.id,p_owner:owner,p_decision:decision});
  }else plan=fallbackPlan(text);
 }
 const cityOnly=cityJustSelected&&(yes(text)||branch&&[branch.id,branch.name,...branch.aliases].some(name=>[name,'en '+name,'soy de '+name,'estoy en '+name].map(normalize).includes(t)));
 if(cityOnly&&state.pendingTopic&&!['comprar','cantidad'].includes(plan.topic)){plan.topic=state.pendingTopic;delete state.pendingTopic;}
 // Explicit requests win over model wording and cannot be converted into a sale.
 const simple=fallbackPlan(text);
 if(simple.topic==='quitar_platillo'||plan.topic==='quitar_platillo')return handoff('package_change',`Los paquetes conservan todos sus platillos. Marqué tu solicitud para que ${profile.ownerName||'la persona responsable'} revise esa excepción antes de cambiarlo.`);
 if(simple.topic==='humano'||plan.topic==='humano')return handoff('customer_request','Tu conversación quedó marcada para atención de la persona responsable. Conservamos lo que ya nos compartiste para que pueda continuar contigo.');
 if(plan.topic==='comprobante')return handoff('payment_proof','El pago necesita revisión del comprobante. La conversación quedó marcada para Diana; todavía no está confirmado.');
 if(plan.topic==='cancelar'||simple.topic==='cancelar'){
  if(state.order||Object.values(state.operations).some(o=>o.status!=='done'))return handoff('cancel_order','La cancelación de una operación ya iniciada requiere revisión. Marqué esta conversación para la persona responsable.');
  for(const k of Object.keys(state))delete state[k];Object.assign(state,{stage:'discovery',customer:{},extras:[],history:[],operations:{}});
  return save('De acuerdo, descarté lo que estábamos preparando en este chat. Puedes retomar cuando quieras.');
 }
 const askCity=()=>{if(state.rejectedCityHint)return '¿En qué ciudad necesitas la entrega?';state.pendingCityHint=cityHint(job.message.from,profile.branches);return cityQuestion(profile,job.message.from);};
 const faq=()=>{
  if(plan.topic==='funcionamiento')return supportedReply(plan.reply,facts)||profile.faq.funcionamiento;
  if(plan.topic==='duda')return supportedReply(plan.reply,facts)||'Ese dato todavía está pendiente de cargar en la información del negocio.';
  if(plan.topic==='pago')return profile.faq.pago||'Los datos de pago todavía están pendientes de configurar.';
  if(plan.topic==='ubicacion')return branch?.address?`Para ${branch.name}: ${branch.address}.`:(branch?`La dirección exacta de ${branch.name} todavía está pendiente de cargar.`:'');
  if(plan.topic==='cobertura')return branch?.coverage?.length?`En ${branch.name} tenemos registradas estas zonas: ${branch.coverage.map(z=>typeof z==='string'?z:z.name).join(', ')}.`:(branch?`La cobertura exacta de ${branch.name} todavía está pendiente de cargar.`:'');
  if((plan.topic==='precio'||plan.topic==='menu')&&menu){
   const historical=menu.status!=='abierto';
   return `${historical?'Menú anterior de referencia para esta prueba':'Menú disponible'} de ${branch.name}: ${menu.name}, ${money(menu.priceMxn)} por paquete.${facts.menu.dishes.length?' Incluye '+facts.menu.dishes.join(', ')+'.':''}${historical?' Aún no puedo aceptar pedidos reales con este menú.':''}`;
  }
  if(plan.topic==='menu'||plan.topic==='precio')return branch?`No tengo un menú disponible para ${branch.name} en este momento.`:'';
  return '';
 };
 const answer=faqTopics.has(plan.topic)?faq():'';
 if(!state.cityId){if(faqTopics.has(plan.topic))state.pendingTopic=plan.topic;
  const greeting=!answer&&/^(hola|buenos dias|buenas tardes|buenas noches)/.test(t)?`¡Hola! Soy el asistente de ${profile.businessName}; te ayudo con tus dudas y tu pedido.`:'';
  return save([answer||greeting,askCity()].filter(Boolean).join('\n\n'));}
 // Natural city changes never reuse another city's menu, address or quote.
 if(!menu&&['comprar','cantidad','confirmar'].includes(plan.topic))return save(`Todavía no tengo un menú disponible para ${branch.name}. Conservé tu ciudad para cuando esté publicado.`);
 const isQuestion=faqTopics.has(plan.topic);
 const takeName=safeField(plan.name,text,80),takeEmail=safeField(plan.email,text,254),takeAddress=safeField(plan.address,text,500);
 // Corrections must work even after all fields have been collected: a model
 // classification alone must never turn an unconfirmed change into consent.
 const nameCorrection=text.match(/\b(?:mi nombre es|me llamo|soy)\s+([\p{L}][\p{L}' -]{0,78}?)(?=\s*,|\s+no\s|[.!?]|$)/iu);
 const summary=()=>`Prepararé ${state.quantity} paquete(s) para ${state.customer.name} en ${branch.name}. Correo: ${state.customer.email}. Dirección: ${state.customer.address}, CP ${state.customer.postalCode}. Usaremos el teléfono de este WhatsApp. ¿Confirmas estos datos y que los usemos para tu registro y pedido?`;
 if(['consent','reviewCorrections'].includes(state.stage)&&nameCorrection){
  state.customer.name=nameCorrection[1].trim();
  state.stage='reviewCorrections';
  return save(`Gracias por corregirme, ${state.customer.name}. Ya actualicé el nombre en esta prueba. ¿Quieres revisar el resumen actualizado?`);
 }
 if(['consent','reviewCorrections'].includes(state.stage)&&/\b(?:paquete|paquetes)\b/.test(t)&&/\b(?:no|cambia|cambiar|corrige|corregir|quiero|son|serian|mejor)\b/.test(t)){
  const correctedQuantity=parseQuantity(text);
  if(correctedQuantity){state.quantity=correctedQuantity;state.stage='reviewCorrections';
   return save(`Entendido, actualicé la selección a ${correctedQuantity} paquete(s) en esta prueba. ¿Quieres revisar el resumen actualizado?`);}
  state.stage='quantity';delete state.quantity;delete state.pendingQuantity;
  return save('Claro, corrijamos la cantidad. ¿Cuántos paquetes quieres pedir?');
 }
 if(state.stage==='reviewCorrections'&&yes(text)){state.stage='consent';return save(summary());}
 if(state.stage==='reviewCorrections'&&/^(?:no)[.!\s]*$/.test(t))return save('De acuerdo, no confirmaré los datos. Puedes decirme qué más quieres corregir cuando gustes.');
 if(state.stage==='consent'&&/^(?:no|no confirmo|no es correcto)[.!\s]*$/.test(t))
  return save('Entendido, no confirmaré los datos. ¿Qué parte quieres corregir?');
 if((['consent','reviewCorrections','quantity'].includes(state.stage))&&(/ya te lo dije|ya te dije|no me entiendes|no entiendes/.test(t)||/^[😠😡😤]+$/u.test(text)))
  return save('Perdón, no te entendí bien. Quiero corregirlo. ¿Qué dato entendí mal?');
 if(state.stage==='name'&&!isQuestion&&/^(?:mio|mia|yo|si|no)$/i.test(t))return save('Para anotarlo bien, ¿cuál es tu nombre?');
 if(takeName)state.customer.name=takeName;
 if(takeEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(takeEmail))state.customer.email=takeEmail.toLowerCase();
 if(takeAddress)state.customer.address=takeAddress;
 if(typeof plan.postalCode==='string'&&/^\d{5}$/.test(plan.postalCode)&&text.includes(plan.postalCode))state.customer.postalCode=plan.postalCode;
 if(state.stage==='name'&&!isQuestion&&!takeName&&text.length>=2&&text.length<=80&&!/[?¿@]/.test(text))state.customer.name=text;
 if(state.stage==='email'&&!isQuestion&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))state.customer.email=text.toLowerCase();
 if(state.stage==='address'&&!isQuestion&&text.length>=8&&!/[?¿]/.test(text))state.customer.address=text;
 if(state.stage==='postal'&&!isQuestion&&/^\d{5}$/.test(text))state.customer.postalCode=text;
 let quantity=parseQuantity(text);
 if(state.stage==='quantity'&&!quantity&&/\b(?:semana|dias|dia)\b/.test(t)){
  state.quantityTimeAmbiguous=true;
  return save('Entiendo, buscas comida para la semana. ¿Cuántos paquetes te gustaría pedir? Si aún no sabes, puedo mostrarte el menú.');
 }
 if(state.stage==='quantity'&&state.pendingQuantity){
  if(/\b(?:paquete|paquetes)\b/.test(t)||yes(text)){quantity=state.pendingQuantity;delete state.pendingQuantity;delete state.quantityTimeAmbiguous;}
  else if(/\b(?:dia|dias|semana)\b/.test(t)||/^(?:no)[.!\s]*$/.test(t)){delete state.pendingQuantity;return save('Entendido, hablabas de días. ¿Cuántos paquetes quieres pedir? Si no lo sabes aún, puedo mostrarte el menú.');}
  else return save('Para anotarlo bien, ¿te refieres a paquetes o a días?');
 }
 if(state.stage==='quantity'&&state.quantityTimeAmbiguous&&quantity&&/^\d{1,2}$/.test(t)){
  state.pendingQuantity=quantity;
  return save(`¿Te refieres a ${quantity} paquetes o a ${quantity} días?`);
 }
 if(quantity&&!isQuestion&&(['discovery','quantity'].includes(state.stage)||/\b(cambia|mejor)\b/.test(t))){
  if(state.order)return handoff('change_registered_order','Para cambiar un pedido ya registrado, la persona responsable debe revisarlo. Conservé su referencia para evitar duplicarlo.');
  state.quantity=quantity;delete state.quote;state.stage='quantity';
 }
 const start=['comprar','cantidad'].includes(plan.topic)||(state.stage==='discovery'&&yes(text)&&!cityJustSelected);
 if(state.stage==='discovery'&&start)state.stage='quantity';
 if(state.stage==='discovery'){
  const next=menu?(menu.status==='abierto'?'¿Cuántos paquetes te gustaría pedir?':profile.mode==='test'?'¿Quieres que probemos cómo sería preparar tu pedido?':'¿Quieres que te explique cómo funciona el servicio?'):'¿Quieres conocer cómo funciona el servicio?';
  let reply=[answer||`Con gusto te ayudo con ${profile.businessName} en ${branch.name}.`,next].join('\n\n');
  if(plan.topic==='menu'&&menu&&branch.menuImage?.menuId===menu.id)reply=menuImageReply(branch.menuImage.url,reply);
  return save(reply);
 }
 if(menu?.status!=='abierto'&&profile.mode!=='test')return save('Ese menú ya cerró. Puedo explicarte el servicio, pero necesito un menú abierto para preparar un pedido.');
 let next;
 if(state.stage==='quantity'){
  if(!state.quantity)next='¿Cuántos paquetes deseas?';
  else{state.menuId=menu.id;state.stage='name';}
 }
 if(!next&&['name','email','address','postal'].includes(state.stage)){
  if(!state.customer.name){state.stage='name';next='¿A nombre de quién lo preparamos?';}
  else if(!state.customer.email){state.stage='email';next='¿Qué correo quieres usar para tu registro? No necesito tu contraseña.';}
  else if(!state.customer.address){state.stage='address';next='¿Cuál es la dirección de entrega: calle, número, colonia y municipio?';}
  else if(!state.customer.postalCode){state.stage='postal';next='¿Cuál es tu código postal?';}
  else{state.stage='consent';next=summary();}
 }
 if(!next&&state.stage==='consent'){
  if(isQuestion)next='¿Confirmas los datos que revisamos para continuar?';
  else if(!yes(text))next='¿Confirmas los datos o quieres corregir alguno?';
  else{
   state.consentedAt=new Date(clock()).toISOString();state.reference||=crypto.randomUUID();
   if(profile.mode==='test'||!profile.capabilities?.registration){state.stage='ready';return save('Los datos quedaron preparados para esta prueba. El registro real en la app, el pedido y los pagos siguen pendientes de habilitar; todavía no creé una cuenta ni un pedido.');}
   const registered=await operation('registration',()=>connector.register({reference:state.reference,branchId:state.cityId,
    customer:{...state.customer,phone:canonicalPhone(job.message.from)},consentedAt:state.consentedAt}));
   if(!registered)return {reply:state.lastReply};
   if(typeof registered.customerId!=='string'||!registered.customerId||registered.customerId.length>200)throw Error('REGISTRATION_INVALID');
   state.customerId=registered.customerId;state.stage='extras';
  }
 }
 if(!next&&state.stage==='extras'){
  const extras=await connector.extraOptions(state.cityId);state.extraOptions=extras;
  state.stage='extrasChoice';next=extras.length?`Puedes agregar platillos adicionales: ${extras.map(e=>e.name).join(', ')}. ¿Quieres alguno o dejamos el paquete completo?`:'¿Dejamos el paquete completo sin adicionales?';
 }
 if(!next&&state.stage==='extrasChoice'){
  if(isQuestion)next='¿Quieres agregar un platillo adicional o dejamos el paquete completo?';
  else if(/^(sin extras|sin adicionales|no|listo|completo|paquete completo)$/.test(t)||yes(text)&&!state.extraOptions.length){state.stage='quote';}
  else{
   const matches=state.extraOptions.filter(e=>normalize(text).includes(normalize(e.name)));
   if(matches.length!==1)next='Dime el nombre del platillo adicional o responde «paquete completo».';
   else{const e=matches[0],prefix=t.match(/^(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/),q=parseQuantity(prefix?.[1]||'')||1,existing=state.extras.find(x=>x.id===e.id);
    if((existing?.quantity||0)+q>20||!existing&&state.extras.length>=10)next='Puedo anotar hasta veinte unidades por adicional y diez adicionales distintos. ¿Qué cantidad dejamos?';
    else{if(existing)existing.quantity+=q;else state.extras.push({id:e.id,quantity:q});next=`Anoté ${q} de ${e.name}. ¿Agregamos otro o dejamos listo el pedido?`;}}
  }
 }
 if(!next&&state.stage==='quote'){
  if(!profile.capabilities?.orders)return save('Conservé tus datos y selección. La creación real de pedidos todavía está pendiente de habilitar.');
  state.quote=await connector.quote({branchId:state.cityId,menuId:state.menuId,quantity:state.quantity,extras:state.extras,
   customerId:state.customerId,customerPhone:canonicalPhone(job.message.from),address:state.customer.address,postalCode:state.customer.postalCode});
  if(!Number.isFinite(state.quote.totalMxn)||state.quote.totalMxn<=0||state.quote.currency!=='MXN'||state.quote.branchId!==state.cityId||state.quote.menuId!==state.menuId)throw Error('QUOTE_INVALID');
  state.stage='confirmOrder';next=`${state.quantity} paquete(s) de ${menu.name}${state.extras.length?' y los adicionales que elegiste':''}. Total verificado con envío: ${money(state.quote.totalMxn)}. ¿Confirmas que preparemos este pedido pendiente de pago?`;
 }
 if(!next&&state.stage==='confirmOrder'){
  if(!yes(text)||isQuestion)next='¿Confirmas el pedido con el total que revisamos?';
  else{
   const fresh=await connector.quote({...state.quote.input,branchId:state.cityId,menuId:state.menuId,quantity:state.quantity,extras:state.extras,customerId:state.customerId,customerPhone:canonicalPhone(job.message.from),address:state.customer.address,postalCode:state.customer.postalCode});
   if(fresh.totalMxn!==state.quote.totalMxn||fresh.quoteRevision!==state.quote.quoteRevision){state.quote=fresh;return save(`El total cambió a ${money(fresh.totalMxn)}. ¿Confirmas este nuevo importe?`);}
   const order=await operation('order',()=>connector.createOrder({reference:state.reference,customerId:state.customerId,quote:state.quote,confirmedAt:new Date(clock()).toISOString()}));
   if(!order)return {reply:state.lastReply};
   if(!order.id||order.status!=='pending_payment'||order.totalMxn!==state.quote.totalMxn)throw Error('ORDER_INVALID');
   state.order=order;state.stage='payment';
   return save(`Ticket ${order.reference||order.id}\n${state.quantity} paquete(s) de ${menu.name}.\nTotal: ${money(order.totalMxn)}.\nEstado: pendiente de pago y revisión.\n\n${paymentInstructions(profile)}\nCuando transfieras, comparte el comprobante para que Diana lo revise.`);
  }
 }
 if(!next&&state.stage==='payment'){
  if(/clip|tarjeta/.test(t)&&profile.payments?.clipEnabled&&profile.capabilities?.payments){
   const payment=await operation('paymentLink',()=>connector.paymentLink({orderId:state.order.id,reference:state.reference,totalMxn:state.order.totalMxn}));
   if(!payment)return {reply:state.lastReply};const url=new URL(payment.url);
   if(url.protocol!=='https:'||url.username||url.password||!['payclip.com','clip.mx'].some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))throw Error('PAYMENT_LINK_INVALID');
   return save(`Puedes pagar tu pedido en este enlace seguro de Clip: ${url.href}. La captura por sí sola no confirma el pago.`);
  }
  next='Cuando tengas el comprobante, compártelo aquí para su revisión.';
 }
 if(!next&&state.stage==='ready')next='Tu selección está guardada para la prueba. El registro y los pagos reales todavía están pendientes de habilitar.';
 return save([answer,next||'¿Qué te gustaría saber del servicio?'].filter(Boolean).join('\n\n'));
 async function operation(name,call){
  const capability={registration:'registration',order:'orders',paymentLink:'payments'}[name];
  if(profile.mode!=='production'||!profile.capabilities?.[capability]){state.stage='ready';await save('La operación real todavía no está habilitada. Conservé los datos para la prueba sin crear una cuenta, pedido ni cobro.');return null;}
  if(state.operations[name]?.status==='done')return state.operations[name].result;
  if(state.operations[name]){await handoff('operation_uncertain','La operación necesita revisión para evitar duplicarla. Conservé los datos y la referencia para la persona responsable.');return null;}
  state.operations[name]={status:'started',reference:state.reference};await persist();
  let result;try{result=await call();}catch{await handoff('operation_uncertain','No pude comprobar el resultado de la operación. Conservé la referencia para revisar antes de volver a intentarla.');return null;}
  state.operations[name]={status:'done',result};await persist();return result;
 }
}
export function paymentInstructions(profile){const p=profile.payments;
 if(p?.bank&&p?.holder&&/^\d{18}$/.test(p?.clabe||''))return `Transferencia\nBanco: ${p.bank}\nTitular: ${p.holder}\nCLABE: ${p.clabe}${p.clipEnabled?'\nSi prefieres tarjeta, puedes pedir el enlace de Clip.':''}`;
 return 'Los datos bancarios y el enlace de pago todavía están pendientes de configurar. No realices una transferencia con datos que no hayan sido confirmados.';
}
