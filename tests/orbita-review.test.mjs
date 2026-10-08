import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReviewHandler} from '../orbita-server/review.mjs';
const origin='https://albavision.tech', root=origin+'/orbita/review';
const access='review-test-access-'.repeat(3);
const env={ORBITA_META_APP_ID:'1782537496230918',ORBITA_REVIEW_ENABLED:'true',ORBITA_REVIEW_ACCESS_HASH:createHash('sha256').update(access).digest('hex'),ORBITA_REVIEW_SESSION_KEY:'session-fixture-'.repeat(4),ORBITA_REVIEW_META_TOKEN:'EAAfixture'};
const context={site:{id:'aa3eb206-3126-4e99-bc91-46a4bb2d59d2'},account:{id:'6864502cf6cc9967e3dac6db'},deploy:{context:'production',published:true}};
const post=(route,body,headers={})=>new Request(root+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
async function authenticate(handler){const r=await handler(post('/session',{accessCode:access}),context);assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);return {cookie:cookie.split(';')[0],csrf:(await r.json()).csrf};}
test('review access is disabled by default and cannot activate in previews, another site or another app',async()=>{
  let calls=0;const fetcher=()=>{calls++;throw new Error('MUST_NOT_CALL_META');};
  for(const overrides of [{ORBITA_REVIEW_ENABLED:undefined},{ORBITA_REVIEW_META_TOKEN:''},{ORBITA_REVIEW_ACCESS_HASH:''},{ORBITA_REVIEW_SESSION_KEY:''},{ORBITA_META_APP_ID:'different'}])assert.equal((await createReviewHandler({env:{...env,...overrides},fetcher})(new Request(root+'/'),context)).status,503);
  const handler=createReviewHandler({env,fetcher});
  for(const invalid of [{...context,deploy:{context:'deploy-preview',published:false}},{...context,deploy:{context:'production',published:false}},{...context,site:{id:'client-site'}},{...context,account:{id:'client-team'}}])assert.equal((await handler(new Request(root+'/'),invalid)).status,503);
  assert.equal((await handler(new Request('https://preview.test/orbita/review/'),context)).status,404);assert.equal(calls,0);
});
test('unauthenticated, forged and expired sessions never reach the account API',async()=>{
  let time=Date.parse('2026-10-08T18:00:00Z'),calls=0;const handler=createReviewHandler({env,now:()=>time,fetcher:()=>{calls++;throw new Error('MUST_NOT_CALL_META');}});
  assert.equal((await handler(new Request(root+'/api/account'),context)).status,403);
  assert.equal((await handler(post('/session',{accessCode:'incorrect'}),context)).status,403);
  const auth=await authenticate(handler);
  assert.equal((await handler(new Request(root+'/api/account',{headers:{Cookie:auth.cookie.replace(/.$/,'X')}}),context)).status,403);
  time+=3601000;assert.equal((await handler(new Request(root+'/api/account',{headers:{Cookie:auth.cookie}}),context)).status,403);assert.equal(calls,0);
});
test('cross-origin login, oversized requests, forged CSRF and client-supplied assets are rejected',async()=>{
  let calls=0;const handler=createReviewHandler({env,fetcher:()=>{calls++;throw new Error('MUST_NOT_CALL_META');}});
  assert.equal((await handler(post('/session',{accessCode:access},{Origin:'https://untrusted.test'}),context)).status,403);
  assert.equal((await handler(post('/session',{accessCode:'x'.repeat(2000)}),context)).status,413);
  const auth=await authenticate(handler);
  assert.equal((await handler(post('/api/template',{}, {Cookie:auth.cookie}),context)).status,403);
  assert.equal((await handler(post('/api/template',{wabaId:'client-account'}, {Cookie:auth.cookie,'X-Orbita-Review-CSRF':auth.csrf}),context)).status,403);
  assert.equal((await handler(new Request(root+'/api/template?wabaId=client-account',{headers:{Cookie:auth.cookie}}),context)).status,400);assert.equal(calls,0);
});
test('authenticated review calls only the fixed test assets and never exposes the Meta token',async()=>{
  const calls=[];const handler=createReviewHandler({env,fetcher:async(url,options)=>{
    calls.push({url,options});assert.equal(options.redirect,'error');
    if(url.includes('/1265673903305629?'))return Response.json({id:'1265673903305629',display_phone_number:'+1 555 178-9080',verified_name:'Test'});
    if(url.includes('/1791155449006041/message_templates?'))return Response.json({data:[{id:'1076740648470416',name:'orbita_revision_demo_20261008',status:'PENDING',category:'UTILITY',language:'es_MX'}]});
    throw new Error('UNEXPECTED_ASSET');
  }});
  const auth=await authenticate(handler);
  for(const route of ['/api/account','/api/template']){const r=await handler(new Request(root+route,{headers:{Cookie:auth.cookie}}),context);assert.equal(r.status,200);assert.ok(!(await r.text()).includes(env.ORBITA_REVIEW_META_TOKEN));}
  const r=await handler(post('/api/template',{}, {Cookie:auth.cookie,'X-Orbita-Review-CSRF':auth.csrf}),context);assert.equal((await r.json()).created,false);
  assert.equal(calls.length,3);assert.ok(calls.every(c=>c.options.method==='GET'));
  assert.equal((await handler(new Request(root+'/operator/status',{headers:{Cookie:auth.cookie}}),context)).status,404);
});
test('template creation uses the fixed demo only and cannot send messages or create orders',async()=>{
  const calls=[];const handler=createReviewHandler({env,fetcher:async(url,options)=>{calls.push({url,options});if(options.method==='GET')return Response.json({data:[]});return Response.json({id:'1076740648470416',status:'PENDING',category:'UTILITY'});}});
  const auth=await authenticate(handler);const r=await handler(post('/api/template',{}, {Cookie:auth.cookie,'X-Orbita-Review-CSRF':auth.csrf}),context);
  assert.equal(r.status,200);assert.equal((await r.json()).created,true);assert.equal(calls.length,2);
  const creation=calls[1];assert.equal(creation.url,'https://graph.facebook.com/v26.0/1791155449006041/message_templates');
  assert.equal(JSON.parse(creation.options.body).name,'orbita_revision_demo_20261008');assert.ok(calls.every(c=>!c.url.includes('supabase')&&!c.url.includes('/messages')));
  assert.equal((await handler(post('/api/messages',{}, {Cookie:auth.cookie,'X-Orbita-Review-CSRF':auth.csrf}),context)).status,404);assert.equal(calls.length,2);
});
test('unknown account responses and provider failures do not disclose credentials or claim success',async()=>{
  const handler=createReviewHandler({env,fetcher:async()=>Response.json({id:'wrong-account',error:{message:env.ORBITA_REVIEW_META_TOKEN}})});
  const auth=await authenticate(handler);assert.equal((await handler(new Request(root+'/api/account',{headers:{Cookie:auth.cookie}}),context)).status,503);
  const unavailable=createReviewHandler({env,fetcher:async()=>Response.json({error:{message:env.ORBITA_REVIEW_META_TOKEN}},{status:403})});const auth2=await authenticate(unavailable);
  const r=await unavailable(new Request(root+'/api/template',{headers:{Cookie:auth2.cookie}}),context);assert.equal(r.status,503);assert.ok(!(await r.text()).includes(env.ORBITA_REVIEW_META_TOKEN));
});
