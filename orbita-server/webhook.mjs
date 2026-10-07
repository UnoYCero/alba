import {canonicalPhone,validSignature,boundedBody,equalSecret} from './security.mjs';
export function extractEvents(payload) {
  if (payload?.object !== 'whatsapp_business_account') return [];
  const events = [];
  for (const entry of Array.isArray(payload.entry)?payload.entry:[]) {
    for (const change of Array.isArray(entry.changes)?entry.changes:[]) {
      if (change.field !== 'messages') continue;
      const value = change.value || {}; const phoneNumberId = String(value.metadata?.phone_number_id || '');
      if (!/^\d{6,30}$/.test(String(entry.id)) || !/^\d{6,30}$/.test(phoneNumberId)) continue;
      for (const message of Array.isArray(value.messages)?value.messages:[]) {
        const from = canonicalPhone(message.from); const time = Number(message.timestamp);
        if (typeof message.id !== 'string' || message.id.length > 220 || !message.id || !/^\d{10,15}$/.test(from) ||
          !Number.isFinite(time) || time <= 0 || time * 1000 > Date.now()+300000) continue;
        const contact = (Array.isArray(value.contacts)?value.contacts:[]).find(item=>canonicalPhone(item.wa_id)===from);
        const body = message.type === 'text' ? message.text?.body : message.type === 'button' ? message.button?.text :
          message.type === 'interactive' ? (message.interactive?.button_reply?.title || message.interactive?.list_reply?.title) : '';
        const media = ['image','document','video','audio'].includes(message.type) ? String(message[message.type]?.id || '').slice(0,220) : null;
        events.push({kind:'inbound',wabaId:String(entry.id),phoneNumberId,id:message.id,from,name:String(contact?.profile?.name || 'Cliente').slice(0,80),
          body:String(body || '').trim().slice(0,4000),mediaId:media || null,type:String(message.type || 'unknown').slice(0,30),receivedAt:new Date(time*1000).toISOString()});
      }
      for (const status of Array.isArray(value.statuses)?value.statuses:[]) {
        if (typeof status.id !== 'string' || status.id.length > 220 || !['sent','delivered','read','failed'].includes(status.status)) continue;
        events.push({kind:'receipt',wabaId:String(entry.id),phoneNumberId,id:status.id,status:status.status,
          from:canonicalPhone(status.recipient_id),errorCode:Number.isSafeInteger(status.errors?.[0]?.code)?status.errors[0].code:null});
      }
    }
  }
  return events;
}
export async function receiveWebhook(request, env, database) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('hub.mode') !== 'subscribe' || !await equalSecret(url.searchParams.get('hub.verify_token'),env.ORBITA_META_VERIFY_TOKEN)) return new Response('Forbidden',{status:403});
    const challenge = url.searchParams.get('hub.challenge');
    if (!challenge || challenge.length > 256) return new Response('Invalid challenge',{status:400});
    return new Response(challenge,{headers:{'Cache-Control':'no-store','Content-Type':'text/plain'}});
  }
  if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
  const bytes = await boundedBody(request);
  if (!await validSignature(bytes,request.headers.get('x-hub-signature-256'),env.ORBITA_META_APP_SECRET)) return new Response('Forbidden',{status:403});
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { return new Response('Invalid JSON',{status:400}); }
  // Tenant ownership comes from the server registry, never the customer text.
  const events = extractEvents(payload);
  const result = await database.rpc('orbita_ingest',{p_app_id:env.ORBITA_META_APP_ID,p_events:events});
  return Response.json({received:true,added:result.added},{headers:{'Cache-Control':'no-store'}});
}
