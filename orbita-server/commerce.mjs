import {canonicalPhone} from './security.mjs';
import {createCommerceStore} from './commerce-store.mjs';
const norm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
const money=n=>`$${Number(n).toFixed(2)} MXN`;
const quantityWords=['un','uno','una','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez'];
export function parseQuantity(text) {
 const t=norm(text), matched=t.match(/\b(?:quiero|pedido de|pedir|comprar|serian|cantidad|cambia a)\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/) ||
   t.match(/\b(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:paquetes?|menus?)\b/) || t.match(/^(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/);
 if(!matched)return null;
 const value=/^\d+$/.test(matched[1])?Number(matched[1]):matched[1].startsWith('un')?1:quantityWords.indexOf(matched[1])-1;
 return value>=1 && value<=20 ? value : null;
}
function choose(text,rows) {
 const t=norm(text);
 if(/^\d{1,2}$/.test(t))return rows[Number(t)-1] || null;
 const matches=rows.filter(row=>norm(row.name)===t || (norm(row.name).length>=3 && t.includes(norm(row.name))) ||
  (t.length>=3 && norm(row.name).includes(t)) ||
  (/^[a-z_-]{2,20}$/i.test(row.id||'') && new RegExp('\\b'+norm(row.id)+'\\b').test(t)));
 return matches.length===1 ? matches[0] : null;
}
const options=(rows,label)=>`${label}\n${rows.map((r,i)=>`${i+1}. ${r.name}${r.priceMxn!==undefined?' · '+money(r.priceMxn):''}`).join('\n')}`;
const yes=t=>/^(?:si|si confirmo|confirmo|confirmar|de acuerdo|acepto|adelante)[.!\s]*$/.test(norm(t));
function summary(quote,input) {
 return `${quote.menuName}: ${input.quantity} paquete(s).\nMenú: ${money(quote.subtotalMxn)}\nExtras: ${money(quote.extrasMxn)}\nEntrega: ${money(quote.deliveryMxn)}\nDescuento: ${money(quote.discountMxn)}\nTotal: ${money(quote.totalMxn)}\n${input.fulfillment==='pickup'?'Recogida en sucursal':`Entrega: ${input.address}, CP ${input.postalCode}`}\nPago: ${input.paymentMethod==='efectivo'?'efectivo autorizado al recibir':'transferencia, por verificar'}.\n¿Confirmas enviar esta solicitud al equipo? Responde «sí» o «cancelar». El pago y la disponibilidad se revisan antes de confirmar el pedido.`;
}
export function createCommerceConnector(credentials,fetcher=fetch,{reviewToken}={}) {
 const base='https://lajstcbseugkjmkasnjd.supabase.co/functions/v1/orbita-integration';
 if(credentials.siteBase!==base || !credentials.siteToken)throw new Error('CONNECTOR_NOT_CONFIGURED');
 async function call(path,body,review=false) {
  const r=await fetcher(base+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:`Bearer ${credentials.siteToken}`,
   'Content-Type':'application/json',...(review?{'x-orbita-review-authorization':reviewToken || ''}:{})},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw Object.assign(new Error('BUSINESS_OPERATION_FAILED'),{code:data.code || 'BUSINESS_UNAVAILABLE'});
  return data;
 }
 return {catalog:()=>call('/catalog'),options:branch=>call('/commerce/options?branchId='+encodeURIComponent(branch)),
  async quote(input) {
   const q=await call('/commerce/quote',input);
   if(q.branchId!==input.branchId || q.menuId!==input.menuId || q.quantity!==input.quantity || q.currency!=='MXN' ||
    !['unitPriceMxn','subtotalMxn','extrasMxn','deliveryMxn','discountMxn','totalMxn'].every(k=>Number.isFinite(q[k])&&q[k]>=0) ||
    Math.abs(q.subtotalMxn+q.extrasMxn+q.deliveryMxn-q.discountMxn-q.totalMxn)>.01 ||
    !/^[a-f0-9]{32}$/.test(q.quoteRevision || '') || !Number.isFinite(Date.parse(q.expiresAt)) || q.availabilityConfirmed!==false)
    throw new Error('QUOTE_INVALID');
   return q;
  },
  async finalize(input) {const result=await call('/commerce/finalize',input,true);
   if(result.id!==`orbita-${input.reference}` || result.status!=='confirmado')throw new Error('ORDER_RESULT_INVALID');return result;},
  status:(id,branch,customer)=>call(`/orders/${encodeURIComponent(id)}?branchId=${encodeURIComponent(branch)}&customerId=${encodeURIComponent(customer)}`)
 };
}
// Field choices are resolved only against the authenticated catalogue. Jev's
// intent can route a conversation but cannot set a price, phone, payment or ID.
export async function prepareCommerceReply(job,decision,connector,database,owner,{clock=Date.now,store}={}) {
 if(!store)throw new Error('COMMERCE_STORE_REQUIRED');
 const context=await store.context(job,owner);
 if(context.held){await database.rpc('orbita_commerce_skip',{p_message_id:job.id,p_owner:owner});return {held:true};}
 const text=job.message.body.trim(),t=norm(text), state=structuredClone(context.state);
 if(/^sankalpa (pedido|confirmar) /i.test(text))return null;
 if(state.lastMessageId===job.message.id)return {reply:state.lastReply};
 let newRequest=null;
 async function save(reply) {
  state.lastMessageId=job.message.id;state.lastReply=reply;
  await store.commit(job,owner,context.revision,state,newRequest);
  return {reply};
 }
 if(job.message.mediaId || (decision?.routable && decision.intent==='ayuda') || /^(ayuda|humano|asesor|hablar con una persona)$/.test(t) || /\b(cupon|codigo promocional|promocion)\b/.test(t)) {
  await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});
  state.stage='human';
  return save('El equipo revisará tu conversación. Si enviaste un comprobante, eso no confirma el pago.');
 }
 if(/^(estado|mi pedido|como va mi pedido|que paso con mi pedido)[?¿.]*$/.test(t)) {
  const r=context.request;
  if(!r)return save('Todavía no tienes una solicitud registrada en este chat. Escribe «quiero pedir» para comenzar.');
  if(r.status==='confirmed' && r.orderId && r.body.quote.customerId) {
   const actual=await connector.status(r.orderId,r.body.input.branchId,r.body.quote.customerId);
   if(actual.id!==r.orderId || actual.customerId!==r.body.quote.customerId || actual.branchId!==r.body.input.branchId)throw new Error('ORDER_CONTEXT_INVALID');
   return save(`Pedido ${actual.reference || actual.id}: ${actual.status}. Pago: ${actual.paymentStatus}. Total: ${money(actual.totalMxn)}.`);
  }
  return save(r.status==='cancelled'?'Tu solicitud fue cancelada.':r.status==='pending'?'Tu solicitud está pendiente de revisar pago, entrega y disponibilidad.':'Tu solicitud necesita revisión del responsable; todavía no puedo confirmar el pedido.');
 }
 if(/^(cancelar|cancela|no confirmo)[.!]*$/.test(t) || (state.stage==='confirm' && t==='no')) {
  if(state.stage==='submitted' && context.request && !await database.rpc('orbita_commerce_customer_cancel',
    {p_message_id:job.id,p_owner:owner,p_request_id:context.request.id}))
    return save('La solicitud está en revisión o ya fue confirmada. Escribe «ayuda» para solicitar su cancelación.');
  for(const k of Object.keys(state))delete state[k];
  return save('Cancelé esta cotización. Escribe «quiero pedir» cuando quieras comenzar otra.');
 }
 const starting=(decision?.routable && decision.intent==='pedido') || /\b(quiero|pedir|comprar|pedido|paquetes)\b/.test(t);
 if(!state.stage || state.stage==='human' || state.stage==='submitted') {
  if(context.request && ['pending','committing','uncertain'].includes(context.request.status) && starting)
    return save('Ya hay una solicitud pendiente en este chat. Escribe «estado» para consultarla o «ayuda» para cambiarla.');
  if(!starting)return null; // Existing menu handling remains unchanged.
  state.stage='branch';state.input={customerPhone:canonicalPhone(job.message.from),extras:[]};
  state.input.quantity=parseQuantity(text) || undefined;
 }
 const catalog=await connector.catalog();
 if(!Array.isArray(catalog.branches)||!Array.isArray(catalog.menus))throw new Error('CATALOG_INVALID');
 if(state.stage==='branch') {
  const branch=choose(text,catalog.branches) || (catalog.branches.length===1?catalog.branches[0]:null);
  if(!branch)return save(options(catalog.branches,'¿En qué sucursal quieres pedir? Responde con su nombre o número.'));
  state.input.branchId=branch.id;state.stage='menu';
 }
 if(state.stage==='menu') {
  const menus=catalog.menus.filter(m=>m.branchId===state.input.branchId && m.status==='abierto' && m.priceMxn>0);
  if(!menus.length){state.stage=null;return save('Esta sucursal no tiene un menú abierto. Puedes consultar el menú anterior o pedir ayuda al equipo.');}
  const menu=choose(text,menus) || (menus.length===1?menus[0]:null);
  if(!menu)return save(options(menus,'¿Qué menú quieres? Responde con su nombre o número.'));
  state.input.menuId=menu.id;state.stage='quantity';
 }
 if(state.stage==='quantity') {
  const q=state.input.quantity || (context.state.stage==='quantity'?parseQuantity(text):null);
  if(!q)return save('¿Cuántos paquetes quieres? Puedes pedir de 1 a 20.');
  state.input.quantity=q;state.stage='name';return save('¿A nombre de quién registramos la solicitud?');
 }
 if(state.stage==='name') {
  if(text.length<2 || text.length>80 || /[<>\n]/.test(text))return save('Escribe un nombre de 2 a 80 caracteres.');
  state.input.customerName=text;state.stage='fulfillment';return save('¿Prefieres entrega a domicilio o recoger en sucursal?');
 }
 if(state.stage==='fulfillment') {
  if(/recog|recoger|sucursal/.test(t)){state.input.fulfillment='pickup';state.stage='extras';}
  else if(/domicilio|entrega|envio/.test(t)){state.input.fulfillment='delivery';state.stage='address';return save('Escribe la dirección completa de entrega: calle, número, colonia y municipio.');}
  else return save('Responde «domicilio» o «recoger».');
 }
 if(state.stage==='address') {
  if(text.length<8||text.length>500)return save('Necesito la dirección completa, de 8 a 500 caracteres.');
  state.input.address=text;state.stage='postal';return save('¿Cuál es el código postal de cinco dígitos?');
 }
 if(state.stage==='postal') {
  if(!/^\d{5}$/.test(t))return save('Escribe un código postal de cinco dígitos.');
  state.input.postalCode=t;state.stage='zone';
  const config=await connector.options(state.input.branchId);
  const zones=config.deliveryZones.filter(z=>!z.postalCode||z.postalCode===t);
  if(!zones.length){state.stage='human';await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});return save('No encontré una zona de entrega para ese código postal. El equipo debe revisar la cobertura.');}
  state.zones=zones;return save(options(zones,'Elige la zona que corresponde a tu dirección.'));
 }
 if(state.stage==='zone') {
  const zone=choose(text,state.zones || []);if(!zone)return save(options(state.zones || [],'No identifiqué la zona. Elige una de estas opciones.'));
  state.input.zoneId=zone.id;delete state.zones;state.stage='extras';
 }
 if(state.stage==='extras') {
  const config=await connector.options(state.input.branchId);state.extraOptions=config.extras;
  state.stage='extrasChoice';
  if(config.extras.length)return save(options(config.extras,'Puedes agregar extras por nombre y cantidad, por ejemplo «dos» seguido del nombre. Termina con «listo» o «sin extras».'));
  state.stage='payment';
 }
 if(state.stage==='extrasChoice') {
  if(!/^(sin extras|ninguno|ninguna|no|listo)$/.test(t)) {
   const extra=choose(text,state.extraOptions||[]);
   if(!extra)return save('No identifiqué el extra. Escribe su nombre exacto o «sin extras».');
   const prefix=!/^\d+$/.test(t)&&t.match(/^(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
   const q=prefix?parseQuantity(prefix[1]):1;
   if(!q)return save('La cantidad del extra debe estar entre 1 y 20.');
   const existing=state.input.extras.find(e=>e.id===extra.id);
   if(existing && existing.quantity+q>20 || !existing && state.input.extras.length>=10)return save('El límite es diez tipos de extras y veinte unidades por tipo.');
   if(existing)existing.quantity+=q;else state.input.extras.push({id:extra.id,quantity:q});
   return save(`Agregué ${q} de ${extra.name}. Puedes agregar otro extra o escribir «listo» para cotizar.`);
  }
  if(/^(sin extras|ninguno|ninguna|no)$/.test(t))state.input.extras=[];
  delete state.extraOptions;state.stage='payment';
 }
 if(state.stage==='payment') {
  state.stage='paymentChoice';return save('¿Cómo prefieres pagar: transferencia o efectivo al recibir? El efectivo depende de que Sankalpa lo tenga habilitado para tu cuenta.');
 }
 if(state.stage==='paymentChoice') {
  if(/transferencia/.test(t))state.input.paymentMethod='transferencia';
  else if(/efectivo/.test(t))state.input.paymentMethod='efectivo';
  else return save('Responde «transferencia» o «efectivo». Para tarjeta, el equipo puede ayudarte con el pago en el sitio de Sankalpa.');
  state.stage='quote';
 }
 if(state.stage==='quote') {
  try{state.quote=await connector.quote(state.input);}catch(error){
   if(error.code==='PAYMENT_METHOD_FORBIDDEN'){state.stage='paymentChoice';return save('Sankalpa no tiene habilitado efectivo para esta cuenta. Puedes elegir transferencia o pedir ayuda.');}
   state.stage='human';await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});
   return save('No pude verificar la cotización con Sankalpa. El equipo debe revisar menú, dirección y precios antes de continuar.');
  }
  state.reference=crypto.randomUUID();state.stage='confirm';return save(summary(state.quote,state.input));
 }
 if(state.stage==='confirm') {
  const changed=parseQuantity(text);
  if(changed && /\b(cambia|mejor|quiero|paquetes)\b/.test(t)) {
   state.input.quantity=changed;state.quote=await connector.quote(state.input);state.reference=crypto.randomUUID();
   return save(summary(state.quote,state.input));
  }
  if(!yes(text))return save('Para enviar esta cotización responde «sí». Para descartarla, «cancelar». Puedes cambiar la cantidad con «cambia a 3».');
  if(Date.parse(state.quote.expiresAt)<=clock()) {
   state.quote=await connector.quote(state.input);state.reference=crypto.randomUUID();return save('Actualicé la cotización porque venció.\n'+summary(state.quote,state.input));
  }
  const fresh=await connector.quote(state.input);
  if(fresh.quoteRevision!==state.quote.quoteRevision) {
   state.quote=fresh;state.reference=crypto.randomUUID();return save('La cotización cambió. Necesito tu confirmación del nuevo total.\n'+summary(fresh,state.input));
  }
  newRequest={id:state.reference,body:{input:state.input,quote:state.quote,confirmedAt:new Date(clock()).toISOString(),sourceMessageId:job.message.id}};
  state.stage='submitted';
  return save(`Solicitud ${state.reference.slice(0,8)} enviada al equipo de Sankalpa. Total cotizado: ${money(state.quote.totalMxn)}. Todavía deben revisar pago, entrega y disponibilidad. Escribe «estado» para consultar su avance.`);
 }
 return save('Escribe «quiero pedir», «estado» o «ayuda».');
}
export function commerceStoreFor(database,env){return createCommerceStore(database,env.ORBITA_CREDENTIAL_KEY,env.ORBITA_META_APP_ID);}
