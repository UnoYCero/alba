import {canonicalPhone} from './security.mjs';
const BASE = 'https://lajstcbseugkjmkasnjd.supabase.co/functions/v1/orbita-integration';
export function createSankalpaConnector(credentials, fetcher = fetch) {
  if (credentials.siteBase !== BASE || !credentials.siteToken) throw new Error('CONNECTOR_NOT_CONFIGURED');
  async function request(path, body) {
    const response = await fetcher(`${BASE}/${path}`, {method:body?'POST':'GET', redirect:'error',
      headers:{Authorization:`Bearer ${credentials.siteToken}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('BUSINESS_OPERATION_FAILED');
    return response.json();
  }
  return {
    async catalog() {
      const result = await request('catalog');
      if (![result?.menus,result?.dishes,result?.branches,result?.packages].every(Array.isArray)) throw new Error('CATALOG_INVALID');
      return result;
    },
    async quote(input) {
      const quote = await request('quote',input);
      if (quote.branchId !== input.branchId || quote.menuId !== input.menuId || quote.quantity !== input.quantity ||
        quote.currency !== 'MXN' || !Number.isFinite(quote.subtotalMxn) || quote.subtotalMxn <= 0 ||
        !Number.isFinite(quote.unitPriceMxn) || quote.unitPriceMxn <= 0 || !quote.menuName?.trim() ||
        Math.abs(quote.subtotalMxn-Math.round(quote.unitPriceMxn*input.quantity*100)/100) > .01 || quote.availabilityConfirmed !== false) throw new Error('QUOTE_INVALID');
      return quote;
    },
    async submit(input) {
      const result = await request('order-requests',input);
      if (!result.id || result.requestReference !== input.requestReference || result.branchId !== input.branchId ||
        result.menuId !== input.menuId || result.quantity !== input.quantity || result.subtotalMxn !== input.expectedSubtotalMxn ||
        result.currency !== 'MXN' || result.status !== 'revision_humana' || result.paymentStatus !== 'sin_verificar' ||
        result.orderId !== null || result.includesDelivery !== false || result.inventoryConfirmed !== false) throw new Error('SUBMISSION_INVALID');
      return result;
    }
  };
}
export async function prepareSankalpaReply(job, decision, connector, database, owner) {
  const message = job.message; const text = message.body.trim();
  if (message.mediaId) return 'Archivo recibido para revisión humana. El pago sigue sin verificar.';
  const order = text.match(/^sankalpa pedido ([a-z0-9_-]{1,40}) ([a-z0-9_-]{1,100}) ([0-9]{1,2})$/i);
  const confirmation = text.match(/^sankalpa confirmar ([a-f0-9-]{36})$/i);
  const intent = !order && !confirmation && decision?.routable ? decision.intent : null;
  if (/^(?:sankalpa\s+)?(?:men[uú]|hola|ver men[uú])$/i.test(text) || intent === 'menu') {
    const catalog = await connector.catalog();
    const available = catalog.menus.filter(menu=>menu.status==='abierto' && menu.priceMxn > 0);
    if (available.length) return `Menús abiertos:\n${available.map(menu=>`${menu.branchId} · ${menu.id} · ${menu.name} · $${menu.priceMxn} MXN`).join('\n')}\nPara cotizar: sankalpa pedido SUCURSAL MENU CANTIDAD. Envío y disponibilidad por revisar. Escribe ayuda para contactar al equipo.`;
    return `Menú anterior para consulta:\n${catalog.menus.map(menu=>`${menu.name} (${menu.branchId}) · $${menu.priceMxn} MXN\n${(menu.dishIds||[]).map(id=>catalog.dishes.find(dish=>dish.id===id)?.name).filter(Boolean).join(', ')}\nPeriodo: ${menu.startsAt} a ${menu.endsAt}. Estado: ${menu.status}.`).join('\n\n')}\nNo hay menús abiertos para pedidos. Escribe ayuda para contactar al equipo.`;
  }
  if (/^(?:sankalpa\s+)?(?:ayuda|asesor|humano)$/i.test(text) || intent === 'ayuda') {
    await database.rpc('orbita_handoff',{p_message_id:job.id,p_owner:owner});
    return 'Registré tu solicitud de ayuda para el equipo de Sankalpa. Un responsable debe revisar esta conversación.';
  }
  if (order) {
    const quantity = Number(order[3]);
    if (quantity < 1 || quantity > 20) return 'La cantidad debe estar entre 1 y 20.';
    const existing = await database.rpc('orbita_case_for_message',{p_message_id:job.id,p_owner:owner});
    const quote = existing?.quote || await connector.quote({branchId:order[1],menuId:order[2],quantity});
    const item = existing || await database.rpc('orbita_save_case',{p_message_id:job.id,p_owner:owner,p_case_id:crypto.randomUUID(),p_quote:quote});
    return `${quote.menuName}: ${quantity} paquete(s), subtotal $${quote.subtotalMxn} MXN. Envío y disponibilidad por revisar. Para registrar esta solicitud pendiente de revisión: sankalpa confirmar ${item.id}`;
  }
  if (confirmation) {
    const item = await database.rpc('orbita_find_case',{p_message_id:job.id,p_owner:owner,p_case_id:confirmation[1]});
    if (!item) return 'No encontré esa cotización para tu teléfono. Envía sankalpa menu para comenzar.';
    const quote = item.quote;
    const result = item.submission || await connector.submit({branchId:quote.branchId,menuId:quote.menuId,quantity:quote.quantity,
      requestReference:item.id,customerName:message.name,customerPhone:canonicalPhone(message.from),expectedSubtotalMxn:quote.subtotalMxn});
    await database.rpc('orbita_submit_case',{p_message_id:job.id,p_owner:owner,p_case_id:item.id,p_submission:result});
    return `Solicitud registrada en Sankalpa: ${result.id}. El equipo debe revisar pago, envío y disponibilidad antes de confirmar el pedido.`;
  }
  if (intent === 'pedido') return 'Para cotizar necesito la sucursal, el menú y la cantidad. Envía sankalpa menu y después sankalpa pedido SUCURSAL MENU CANTIDAD. Envío y disponibilidad requieren revisión.';
  if (intent === 'confirmar') return 'Para registrar una solicitud necesito la referencia de la cotización. Confirma con sankalpa confirmar REFERENCIA. Un mensaje de aceptación no confirma pago ni entrega.';
  return '¿Quieres ver el menú, hacer un pedido o hablar con una persona? Puedes escribir menu o ayuda.';
}
