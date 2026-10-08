import {boundedBody,equalSecret} from './security.mjs';
import {isPublishedProduction} from './netlify-runtime.mjs';
const ROOT='/orbita/review', ORIGIN='https://albavision.tech';
const APP='1782537496230918', WABA='1791155449006041', PHONE='1265673903305629';
const NAME='orbita_revision_demo_20261008', COOKIE='orbita_review';
const encoder=new TextEncoder();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(value,status=200,extra={})=>Response.json(value,{status,headers:{...headers,...extra}});
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const cookie=value=>`${COOKIE}=${value}; Path=${ROOT}; HttpOnly; Secure; SameSite=Strict; Max-Age=${value?3600:0}`;
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Órbita · Review access</title><style>body{font:16px/1.6 system-ui;background:#f2f5f0;color:#18372b;margin:0}main{max-width:800px;margin:35px auto;padding:25px}section{background:white;padding:25px;border:1px solid #dae3db;border-radius:15px;margin:20px 0}button,input{font:inherit;padding:10px;border-radius:8px}button{background:#214a36;color:white;border:0;cursor:pointer}input{border:1px solid #a4b8aa}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf3ed;padding:18px;font-size:14px}.note{font-size:14px}a{color:#214a36}</style><main><h1>Órbita, by Alba Vision</h1><p>Restricted review access to Meta's test account. Sankalpa is a pilot client of the platform.</p><p class="note">This access does not reveal client conversations, expose operator credentials or connect the real Alba Vision phone. The real-number coexistence flow is pending Meta's advanced-permission approval.</p><section id="login"><h2>Reviewer sign-in</h2><form id="form"><label>Review access code <input id="code" type="password" autocomplete="off" required maxlength="256"></label> <button>Sign in</button></form><p id="notice" role="status"></p></section><section id="tools" hidden><h2>Test account and templates</h2><button id="account">Inspect test phone</button> <button id="lookup">Retrieve demonstration template</button> <button id="create">Create demonstration template</button><pre id="result" role="status">Choose an operation.</pre><p class="note">The template describes a request pending human review. Creating it does not send a message or create an order. An existing template is returned without duplication. Message reception is demonstrated separately from the previously verified WhatsApp test recipient.</p><button id="logout">Sign out</button></section><p><a href="/orbita/index.html">Product information</a> · <a href="/orbita/privacy.html">Privacy</a></p></main><script>const root='/orbita/review';let csrf='';async function request(path,method='GET',body){const r=await fetch(root+path,{method,headers:method==='POST'?{'Content-Type':'application/json','X-Orbita-Review-CSRF':csrf}:{},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data}function show(session){csrf=session.csrf;document.getElementById('login').hidden=true;document.getElementById('tools').hidden=false}document.getElementById('form').onsubmit=async e=>{e.preventDefault();const input=document.getElementById('code');try{show(await request('/session','POST',{accessCode:input.value}));document.getElementById('notice').textContent=''}catch(error){document.getElementById('notice').textContent=error.message}finally{input.value=''}};async function operate(path,method){document.querySelectorAll('#tools button').forEach(b=>b.disabled=true);try{document.getElementById('result').textContent=JSON.stringify(await request(path,method,method==='POST'?{}:undefined),null,2)}catch(error){document.getElementById('result').textContent=error.message}finally{document.querySelectorAll('#tools button').forEach(b=>b.disabled=false)}}document.getElementById('account').onclick=()=>operate('/api/account','GET');document.getElementById('lookup').onclick=()=>operate('/api/template','GET');document.getElementById('create').onclick=()=>operate('/api/template','POST');document.getElementById('logout').onclick=async()=>{try{await request('/logout','POST',{});location.reload()}catch(error){document.getElementById('result').textContent=error.message}};request('/session').then(show).catch(()=>{});</script></html>`;
export function createReviewHandler({env,fetcher=fetch,now=()=>Date.now()}={}) {
  const configured=()=>env.ORBITA_REVIEW_ENABLED==='true' && env.ORBITA_META_APP_ID===APP &&
    /^[a-f0-9]{64}$/.test(env.ORBITA_REVIEW_ACCESS_HASH || '') && /^[A-Za-z0-9_-]{43,128}$/.test(env.ORBITA_REVIEW_SESSION_KEY || '') &&
    /^EAA[A-Za-z0-9]+$/.test(env.ORBITA_REVIEW_META_TOKEN || '');
  const sign=async value=>{
    const key=await crypto.subtle.importKey('raw',encoder.encode(env.ORBITA_REVIEW_SESSION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(`orbita-review-v1:${value}`)));
  };
  async function session(request) {
    const value=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if(!/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value || ''))return null;
    const [expiration,nonce,signature]=value.split('.');const seconds=Math.floor(now()/1000);
    if(Number(expiration)<=seconds||Number(expiration)>seconds+3600||!await equalSecret(signature,await sign(`${expiration}.${nonce}`)))return null;
    return {csrf:nonce};
  }
  async function graph(endpoint,{method='GET',body}={}){
    const r=await fetcher('https://graph.facebook.com/v26.0/'+endpoint,{method,headers:{Authorization:`Bearer ${env.ORBITA_REVIEW_META_TOKEN}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(12000),body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)throw new Error('META_TEST_ACCOUNT_UNAVAILABLE');return data;
  }
  async function template(){const data=await graph(`${WABA}/message_templates?name=${NAME}&fields=id,name,status,category,language`);return data.data?.find(x=>x.name===NAME&&x.language==='es_MX') || null;}
  const selected=t=>t?{id:t.id,name:t.name||NAME,status:t.status||'PENDING',category:t.category||'UTILITY',language:t.language||'es_MX'}:null;
  return async(request,context)=>{
    try{
      const url=new URL(request.url);if(url.origin!==ORIGIN||!url.pathname.startsWith(ROOT+'/'))return json({error:'NOT_FOUND'},404);
      if(!isPublishedProduction(context)||!configured())return json({error:'REVIEW_DISABLED'},503);
      const route=url.pathname.slice(ROOT.length);if(url.search)return json({error:'QUERY_NOT_ALLOWED'},400);
      if(request.method==='GET'&&route==='/')return new Response(page,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
      let body;
      if(request.method==='POST'){
        if(request.headers.get('origin')!==ORIGIN||request.headers.get('content-type')!=='application/json')return json({error:'ORIGIN_NOT_ALLOWED'},403);
        try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,1024)));}catch(error){return json({error:error.status===413?'BODY_LIMIT':'INVALID_JSON'},error.status===413?413:400);}
        if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'INVALID_JSON'},400);
      }
      if(route==='/session'&&request.method==='POST'){
        if(typeof body.accessCode!=='string'||body.accessCode.length>256||Object.keys(body).length!==1)return json({error:'INVALID_ACCESS_CODE'},400);
        const hash=hex(await crypto.subtle.digest('SHA-256',encoder.encode(body.accessCode)));
        if(!await equalSecret(hash,env.ORBITA_REVIEW_ACCESS_HASH))return json({error:'INVALID_ACCESS_CODE'},403);
        const value=`${Math.floor(now()/1000)+3600}.${hex(crypto.getRandomValues(new Uint8Array(16)))}`;
        return json({authenticated:true,csrf:value.split('.')[1]},200,{'Set-Cookie':cookie(value+'.'+await sign(value))});
      }
      const current=await session(request);if(!current)return json({error:'SIGN_IN_REQUIRED'},403);
      if(request.method==='POST'&&(Object.keys(body).length!==0||!await equalSecret(request.headers.get('x-orbita-review-csrf'),current.csrf)))return json({error:'ACTION_NOT_ALLOWED'},403);
      if(route==='/session'&&request.method==='GET')return json({authenticated:true,csrf:current.csrf});
      if(route==='/logout'&&request.method==='POST')return json({signedOut:true},200,{'Set-Cookie':cookie('')});
      if(route==='/api/account'&&request.method==='GET'){
        const phone=await graph(`${PHONE}?fields=id,display_phone_number,verified_name`);
        if(String(phone.id)!==PHONE)return json({error:'TEST_ACCOUNT_MISMATCH'},503);
        return json({appId:APP,account:'Meta test account',phoneNumberId:PHONE,displayPhone:phone.display_phone_number,verifiedName:phone.verified_name,realPhoneConnected:false});
      }
      if(route==='/api/template'&&request.method==='GET')return json({template:selected(await template())});
      if(route==='/api/template'&&request.method==='POST'){
        const existing=await template();if(existing)return json({created:false,template:selected(existing)});
        const result=await graph(`${WABA}/message_templates`,{method:'POST',body:{name:NAME,language:'es_MX',category:'UTILITY',components:[{type:'BODY',text:'Tu solicitud {{1}} se recibió y está pendiente de revisión por el equipo del negocio. Este aviso de Órbita no confirma el pago ni la entrega.',example:{body_text:[['DEMO-001']]}}]}});
        return json({created:true,template:selected(result)});
      }
      return json({error:'NOT_FOUND'},404);
    }catch{return json({error:'REVIEW_SERVICE_UNAVAILABLE'},503);}
  };
}
