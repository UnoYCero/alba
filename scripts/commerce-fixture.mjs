// Isolated in-memory database and synthetic catalogue. No production credentials,
// network provider calls or writes to the client's database are permitted here.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEncryptedDatabase} from '../orbita-server/encrypted-database.mjs';
import {sealCredentials} from '../orbita-server/security.mjs';
import {commerceStoreFor,prepareCommerceReply} from '../orbita-server/commerce.mjs';
export const tenant='00000000-0000-4000-8000-000000000001',channel='00000000-0000-4000-8000-000000000002';
export const otherTenant='00000000-0000-4000-8000-000000000003';
export const sender='525500000001',app='1782537496230918',phone='123456789';
export const accessCode='synthetic-isolated-preview-access-'.repeat(2);
export async function commerceFixture(){
 const pg=new PGlite(),env={ORBITA_CREDENTIAL_KEY:'ab'.repeat(32),ORBITA_META_APP_ID:app,ORBITA_COMMERCE_ENABLED:'true',
 ORBITA_PORTAL_ENABLED:'true',ORBITA_PORTAL_SESSION_KEY:'cd'.repeat(32),ORBITA_COMMERCE_REVIEW_TOKENS:JSON.stringify({[tenant]:'synthetic-review-token-'.repeat(3)})};
 env.ORBITA_PORTAL_ACCOUNTS=JSON.stringify([{id:'demo',name:'Responsable de prueba',tenantId:tenant,
 accessHash:createHash('sha256').update(accessCode).digest('hex')},{id:'other',name:'Otro negocio',tenantId:otherTenant,
 accessHash:createHash('sha256').update(accessCode).digest('hex')}]);
 await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of ['schema.sql','encrypted-cutover.sql','coexistence.sql','commerce.sql','management.sql'])await pg.exec(await readFile(new URL('../orbita-database/'+file,import.meta.url),'utf8'));
 await pg.exec('set role service_role');
 const raw={rpc:async(name,p)=>{
  if(!/^orbita_[a-z_]+$/.test(name))throw new Error('Invalid test RPC');
  const entries=Object.entries(p),args=entries.map(([k],i)=>{if(!/^p_[a-z_]+$/.test(k))throw new Error('Invalid argument');return `${k}=>$${i+1}`;}).join(',');
  const values=entries.map(([k,v])=>v!==null&&typeof v==='object' && k!=='p_allowed'?JSON.stringify(v):k==='p_allowed'&&v!==null?'{'+v.join(',')+'}':v);
  return (await pg.query(`select public.${name}(${args}) result`,values)).rows[0].result;
 }},database=createEncryptedDatabase(env,fetch,raw),store=commerceStoreFor(database,env);
 for(const [id,slug] of [[tenant,'sankalpa-demo'],[otherTenant,'other-demo']])await database.rpc('orbita_create_tenant',{p_id:id,p_slug:slug,p_name:slug,p_budget:null});
 const credentials=await sealCredentials({siteBase:'https://lajstcbseugkjmkasnjd.supabase.co/functions/v1/orbita-integration',siteToken:'synthetic-catalog-token',metaAccessToken:'synthetic-meta-token'},env.ORBITA_CREDENTIAL_KEY,tenant,channel);
 await database.rpc('orbita_create_channel',{p_id:channel,p_tenant_id:tenant,p_app_id:app,p_waba_id:phone,p_phone_id:phone,p_connector:'sankalpa-guided-v1',p_credentials:credentials,p_mode:'production',p_allowed:null});
 await database.rpc('orbita_activate_channel',{p_id:channel,p_credentials:credentials});
 await database.rpc('orbita_tenant_state',{p_id:tenant,p_paused:false});
 const catalogue={branches:[{id:'cdmx',name:'CDMX'},{id:'merida',name:'Mérida'}],menus:[{id:'menu-demo',name:'Menú de prueba',branchId:'cdmx',status:'abierto',priceMxn:660}]};
 let unitPrice=660,closed=false;const orders=new Map();
 let connector={catalog:async()=>({...catalogue,menus:catalogue.menus.map(m=>({...m,status:closed?'cerrado':'abierto'}))}),
 options:async()=>({deliveryZones:[{id:'zone-demo',name:'Colonia de prueba',postalCode:'54080',priceMxn:60}],extras:[{id:'extra-demo',name:'Guarnición de prueba',priceMxn:30}]}),
 quote:async input=>{
  if(closed)throw Object.assign(new Error('Menu closed'),{code:'MENU_NOT_OPEN'});
  const subtotalMxn=input.quantity*unitPrice,extrasMxn=input.extras.reduce((sum,e)=>sum+e.quantity*30,0),deliveryMxn=input.fulfillment==='delivery'?60:0;
  return {branchId:input.branchId,menuId:input.menuId,menuName:'Menú de prueba',quantity:input.quantity,unitPriceMxn:unitPrice,
   subtotalMxn,extrasMxn,deliveryMxn,discountMxn:0,totalMxn:subtotalMxn+extrasMxn+deliveryMxn,currency:'MXN',availabilityConfirmed:false,
   customerVerified:true,customerId:'demo-client',quoteRevision:createHash('md5').update(JSON.stringify([input,unitPrice])).digest('hex'),expiresAt:new Date(Date.now()+900000).toISOString()};
 },status:async(id,branch,customer)=>({id,branchId:branch,customerId:customer,status:'confirmado',paymentStatus:'pago_exitoso',totalMxn:orders.get(id)?.quote.totalMxn||1320})};
 let counter=0;const replies=[];
 async function receive(text,{intent='otro',from=sender,mediaId=null,deferSend=false}={}) {
  const provider='wamid.demo.'+(++counter),owner=crypto.randomUUID();
  await database.rpc('orbita_ingest',{p_app_id:app,p_events:[{kind:'inbound',id:provider,wabaId:phone,phoneNumberId:phone,from,
  name:'Cliente ficticio',body:text,mediaId,type:mediaId?'image':'text',receivedAt:new Date().toISOString()}]});
  const job=await database.rpc('orbita_claim',{p_owner:owner});
  if(!job)throw new Error('No claimed fixture job');
  const result=await prepareCommerceReply(job,{intent,routable:true},connector,database,owner,{store});
  if(result?.held)return {held:true,job,owner};
  const reply=result?.reply||'Menú anterior de prueba';replies.push({customer:text,reply});
  if(deferSend)return {reply,job,owner};
  await database.rpc('orbita_prepare_reply',{p_message_id:job.id,p_owner:owner,p_reply:reply});
  if(await database.rpc('orbita_commerce_begin_send',{p_message_id:job.id,p_owner:owner}))
  await database.rpc('orbita_finish',{p_message_id:job.id,p_owner:owner,p_delivery:{status:'accepted',messageId:'wamid.reply.'+counter,credentialRevision:1}});
  return {reply,job,owner};
 }
 const fetcher=async(url,options)=>{
  if(!String(url).endsWith('/commerce/finalize'))throw new Error('Network not permitted by isolated demo');
  const body=JSON.parse(options.body),id='orbita-'+body.reference;
  orders.set(id,body);return Response.json({id,status:'confirmado',replayed:false});
 };
 return {pg,env,database,store,raw,connector,receive,fetcher,orders,replies,setPrice:n=>unitPrice=n,closeMenu:()=>closed=true,useConnector:value=>connector=value};
}
