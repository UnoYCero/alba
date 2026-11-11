import test from 'node:test';
import assert from 'node:assert/strict';
import receiver from '../netlify/functions/orbita.mjs';
import portal from '../netlify/functions/orbita-portal.mjs';
const origin='https://orbita-entry.example';
test('Supabase entrypoints start without opening the legacy Blobs backend',async()=>{
 const values={ORBITA_STATE_BACKEND:'supabase',ORBITA_PROJECT_REF:'pfptagachuwclcxkmldb',ORBITA_ORGANIZATION_ID:'dgcoyccqqeyjhfatcasa',
  ORBITA_SUPABASE_URL:'https://pfptagachuwclcxkmldb.supabase.co',ORBITA_SUPABASE_SECRET_KEY:'sb_secret_fixture',ORBITA_CREDENTIAL_KEY:'ad'.repeat(32),ORBITA_META_APP_ID:'1782537496230918',
  ORBITA_ENABLED:'false',ORBITA_NETLIFY_SITE_ID:'ab123456-1234-4234-9234-123456789abc',ORBITA_NETLIFY_TEAM_ID:'abcd1234567890abcdef1234',ORBITA_PUBLIC_ORIGIN:origin,
  ORBITA_PORTAL_ENABLED:'true',ORBITA_PORTAL_SESSION_KEY:'ad'.repeat(32),ORBITA_PORTAL_ACCOUNTS:JSON.stringify([{id:'alba',name:'Alba Vision',role:'admin',accessHash:'ad'.repeat(32)}])};
 const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);
 const context={site:{id:values.ORBITA_NETLIFY_SITE_ID},account:{id:values.ORBITA_NETLIFY_TEAM_ID},deploy:{context:'production',published:true}};
 try{
  const health=await receiver(new Request(origin+'/orbita/api/health'),context);assert.equal(health.status,200);assert.equal((await health.json()).enabled,false);
  assert.equal((await portal(new Request(origin+'/orbita/panel'),context)).status,200);
  assert.equal((await portal(new Request(origin+'/orbita/panel'),{...context,deploy:{context:'deploy-preview',published:false}})).status,404);
 }finally{for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
