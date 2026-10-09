import {boundedBody,equalSecret,openCredentials} from './security.mjs';
import {isPublishedProduction} from './netlify-runtime.mjs';
import {commerceStoreFor,createCommerceConnector} from './commerce.mjs';
import {portalPage} from './portal-page.mjs';
const ROOT='/orbita/panel',ORIGIN='https://albavision.tech',COOKIE='orbita_portal';
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s||'');
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(v,status=200,extra={})=>Response.json(v,{status,headers:{...headers,...extra}});
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const enc=new TextEncoder();
const role=a=>a.role==='admin'?'admin':'tenant';
const scope=a=>role(a)==='admin'?'platform':a.tenantId;
const cookie=v=>`${COOKIE}=${v}; Path=${ROOT}; HttpOnly; Secure; SameSite=Strict; Max-Age=${v?3600:0}`;
export function createPortalHandler({env,database,fetcher=fetch,now=Date.now,productionCheck=isPublishedProduction}={}) {
 let accounts;try{accounts=JSON.parse(env.ORBITA_PORTAL_ACCOUNTS||'[]');}catch{accounts=[];}
 const commerceEnabled=env.ORBITA_COMMERCE_ENABLED==='true';
 const ready=env.ORBITA_PORTAL_ENABLED==='true' &&
  /^[a-f0-9]{64}$/i.test(env.ORBITA_PORTAL_SESSION_KEY||'') && accounts.length>0 && accounts.length<=50 &&
  accounts.every(a=>/^[a-z0-9_-]{1,40}$/.test(a.id) && (a.role===undefined||['admin','tenant'].includes(a.role)) && (role(a)==='admin'||uuid(a.tenantId)) && /^[a-f0-9]{64}$/.test(a.accessHash||'') && typeof a.name==='string' && a.name.length<=80) &&
  new Set(accounts.map(a=>a.id)).size===accounts.length;
 async function sign(value){const key=await crypto.subtle.importKey('raw',Uint8Array.from(env.ORBITA_PORTAL_SESSION_KEY.match(/../g),x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,enc.encode(value)));}
 async function session(request) {
  const raw=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!raw)return null;const [id,tenantId,expires,csrf,version,signature,...rest]=raw.split('.');
  const account=accounts.find(a=>a.id===id);
  if(!account || scope(account)!==tenantId || rest.length || !/^\d+$/.test(expires) || Number(expires)<=now()/1000 || Number(expires)>now()/1000+3600 ||
   !/^[a-f0-9]{32}$/.test(csrf||'') || version!==account.accessHash.slice(0,16) || !await equalSecret(signature,await sign([id,tenantId,expires,csrf,version].join('.'))))return null;
  return {account,csrf};
 }
 return async(request,context)=>{
  const url=new URL(request.url),route=url.pathname.slice(ROOT.length);
  if(!ready || !productionCheck(context) || (url.pathname!==ROOT && !url.pathname.startsWith(ROOT+'/')))return json({error:'NOT_FOUND'},404);
  try {
   if((route===''||route==='/')&&request.method==='GET')return new Response(portalPage,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
   let body;
   if(request.method==='POST') {
    if(request.headers.get('origin')!==ORIGIN || request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'ORIGIN_NOT_ALLOWED'},403);
    try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,8192)));}catch(e){return json({error:'INVALID_JSON'},e.status||400);}
    if(!body||Array.isArray(body)||typeof body!=='object')return json({error:'INVALID_JSON'},400);
   }
   if(route==='/session'&&request.method==='POST') {
    const a=accounts.find(a=>a.id===body.account);
    if(!a||typeof body.code!=='string'||body.code.length<32||body.code.length>256||Object.keys(body).length!==2)return json({error:'ACCESS_DENIED'},403);
    const hashed=hex(await crypto.subtle.digest('SHA-256',enc.encode(body.code)));
    if(!await equalSecret(hashed,a.accessHash))return json({error:'ACCESS_DENIED'},403);
    const csrf=hex(crypto.getRandomValues(new Uint8Array(16))),value=[a.id,scope(a),Math.floor(now()/1000)+3600,csrf,a.accessHash.slice(0,16)].join('.');
    return json({name:a.name,role:role(a),tenantId:role(a)==='tenant'?a.tenantId:null,csrf,commerceEnabled},200,{'Set-Cookie':cookie(value+'.'+await sign(value))});
   }
   const s=await session(request);if(!s)return json({error:'SIGN_IN_REQUIRED'},403);
   if(request.method==='POST'&&!await equalSecret(request.headers.get('x-orbita-csrf'),s.csrf))return json({error:'ACTION_NOT_ALLOWED'},403);
   const admin=role(s.account)==='admin',selected=url.searchParams.get('tenant');
   if(!admin && ((selected!==null&&selected!==s.account.tenantId)||(body?.tenantId!==undefined&&body.tenantId!==s.account.tenantId)))return json({error:'TENANT_FORBIDDEN'},403);
   const tenant=admin?(body?.tenantId||selected):s.account.tenantId,store=commerceStoreFor(database,env);
   if(route==='/session'&&request.method==='GET')return json({name:s.account.name,role:role(s.account),tenantId:admin?null:tenant,csrf:s.csrf,commerceEnabled});
   if(route==='/logout'&&request.method==='POST')return json({signedOut:true},200,{'Set-Cookie':cookie('')});
   if(route==='/agents'&&request.method==='GET')return json(await database.rpc('orbita_management_summary',{p_tenant_id:admin?null:tenant}));
   if(['/tenant-settings','/clients'].includes(route)&&!admin)return json({error:'ADMIN_REQUIRED'},403);
   if(route==='/clients'&&request.method==='POST') {
    if(Object.keys(body).some(k=>!['name','slug','budgetUsd'].includes(k))||typeof body.name!=='string'||!body.name.trim()||body.name.length>80||!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(body.slug||'')||
     (body.budgetUsd!==null&&(!Number.isFinite(body.budgetUsd)||body.budgetUsd<0||body.budgetUsd>1000000)))return json({error:'INVALID_CLIENT'},400);
    return json(await database.rpc('orbita_create_tenant',{p_id:crypto.randomUUID(),p_slug:body.slug,p_name:body.name.trim(),p_budget:body.budgetUsd}),201);
   }
   if(!uuid(tenant))return json({error:'SELECT_TENANT',message:'Selecciona un cliente.'},400);
   if(route==='/tenant-settings'&&request.method==='POST') {
    if(Object.keys(body).some(k=>!['tenantId','budgetUsd','paused'].includes(k))||typeof body.paused!=='boolean'||(body.budgetUsd!==null&&(!Number.isFinite(body.budgetUsd)||body.budgetUsd<0||body.budgetUsd>1000000)))return json({error:'INVALID_SETTINGS'},400);
    return json(await database.rpc('orbita_management_tenant',{p_tenant_id:tenant,p_budget:body.budgetUsd,p_paused:body.paused,p_actor:s.account.id}));
   }
   if(route==='/agent-state'&&request.method==='POST') {
    if(!admin&&body.jevEnabled!==undefined)return json({error:'ADMIN_REQUIRED'},403);
    if(Object.keys(body).some(k=>!['tenantId','channelId','enabled','jevEnabled'].includes(k))||!uuid(body.channelId)||typeof body.enabled!=='boolean'||(body.jevEnabled!==undefined&&typeof body.jevEnabled!=='boolean'))return json({error:'INVALID_AGENT'},400);
    return json(await database.rpc('orbita_management_agent',{p_tenant_id:tenant,p_channel_id:body.channelId,p_enabled:body.enabled,p_jev_enabled:body.jevEnabled??null,p_actor:s.account.id}));
   }
   if(route==='/requests'&&request.method==='GET')return json({requests:await store.list(tenant)});
   if(route==='/inbox'&&request.method==='GET')return json({conversations:await store.inbox(tenant)});
   if(route==='/conversations'&&request.method==='GET') {
    const channel=url.searchParams.get('channel');if(!uuid(channel))return json({error:'INVALID_CHANNEL'},400);
    const sender=url.searchParams.get('sender');if(sender!==null && !/^\d{10,15}$/.test(sender))return json({error:'INVALID_CONVERSATION'},400);
    return json({messages:await store.conversations(tenant,channel,sender)});
   }
   if(route==='/hold'&&request.method==='POST') {
    if(!uuid(body.channelId)||typeof body.sender!=='string'||!/^\d{10,15}$/.test(body.sender)||typeof body.held!=='boolean')return json({error:'INVALID_CONVERSATION'},400);
    await database.rpc('orbita_commerce_hold',{p_tenant_id:tenant,p_channel_id:body.channelId,p_sender:body.sender,p_held:body.held});
    return json({held:body.held});
   }
   if((route==='/cancel'||route==='/approve')&&request.method==='POST') {
    if(route==='/approve'&&!commerceEnabled)return json({error:'COMMERCE_DISABLED',message:'La creación de pedidos todavía no está activada.'},503);
    if(!uuid(body.id)||!Number.isSafeInteger(body.revision)||body.revision<0)return json({error:'INVALID_REQUEST'},400);
    if(route==='/cancel') {await database.rpc('orbita_commerce_cancel',{p_tenant_id:tenant,p_request_id:body.id,p_revision:body.revision});return json({cancelled:true});}
    if(body.inventoryReviewed!==true||body.paymentReviewed!==true||!['transferencia','efectivo'].includes(body.paymentMethod)||
     typeof body.paymentReference!=='string'||body.paymentReference.trim().length<3||body.paymentReference.length>200)return json({error:'REVIEW_REQUIRED'},400);
    const owner=crypto.randomUUID(),record=await store.reviewClaim(tenant,body.id,body.revision,owner,
     {reviewer:s.account.id,inventoryReviewed:true,paymentReviewed:true,paymentMethod:body.paymentMethod,paymentReference:body.paymentReference.trim()});
    if(record.status==='confirmed')return json({confirmed:true,orderId:record.order_id});
    try {
     const channel=await database.rpc('orbita_operator_channel',{p_id:record.channel_id});
     if(channel?.tenantId!==tenant)throw new Error('CHANNEL_NOT_FOUND');
     const credentials=await openCredentials(channel.credentials,env.ORBITA_CREDENTIAL_KEY,tenant,channel.id);
     const reviewToken=env.ORBITA_COMMERCE_REVIEW_TOKENS ? JSON.parse(env.ORBITA_COMMERCE_REVIEW_TOKENS)[tenant] : null;
     if(typeof reviewToken!=='string'||reviewToken.length<32)throw new Error('REVIEW_NOT_CONFIGURED');
     const result=await createCommerceConnector(credentials,fetcher,{reviewToken}).finalize({reference:body.id,input:record.body.input,quote:record.body.quote,review:record.review});
     await database.rpc('orbita_commerce_review_finish',{p_tenant_id:tenant,p_request_id:body.id,p_owner:owner,p_status:'confirmed',p_order_id:result.id});
     return json({confirmed:true,orderId:result.id});
    }catch(error) {
     const rejected=['QUOTE_EXPIRED','PRICE_CHANGED','CUSTOMER_REVIEW_REQUIRED','ADDRESS_REVIEW_REQUIRED','REVIEW_REQUIRED','MENU_NOT_OPEN','REVIEW_FORBIDDEN','REVIEW_NOT_CONFIGURED','PAYMENT_METHOD_FORBIDDEN'].includes(error.code);
     await database.rpc('orbita_commerce_review_finish',{p_tenant_id:tenant,p_request_id:body.id,p_owner:owner,p_status:rejected?'pending':'uncertain',p_order_id:null});
     return json({error:error.code||'REVIEW_UNCERTAIN',message:'No se confirmó la operación. Conservamos la referencia para reconciliar sin duplicar.'},409);
    }
   }
   return json({error:'NOT_FOUND'},404);
  }catch{return json({error:'ACTION_FAILED',message:'Actualiza el panel y revisa el estado antes de reintentar.'},409);}
 };
}
