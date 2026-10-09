import {sealCredentials,openCredentials} from './security.mjs';
export function createCommerceStore(database,key,app) {
 const seal=(value,scope,id)=>sealCredentials(value,key,scope,id);
 const open=(value,scope,id)=>openCredentials(value,key,scope,id);
 return {
  async context(job,owner) {
   const raw=await database.rpc('orbita_commerce_context',{p_message_id:job.id,p_owner:owner});
   const state=raw.state ? await open(raw.state,'orbita-commerce-session-v1',`${app}:${job.tenantId}:${job.channelId}:${job.message.from}`) : {};
   const request=raw.request ? {...raw.request,body:await open(raw.request.body,'orbita-commerce-request-v1',`${job.tenantId}:${raw.request.id}`)} : null;
   return {...raw,state,request};
  },
  async commit(job,owner,revision,state,request=null) {
   await database.rpc('orbita_commerce_commit',{p_message_id:job.id,p_owner:owner,p_revision:revision,
    p_state:await seal(state,'orbita-commerce-session-v1',`${app}:${job.tenantId}:${job.channelId}:${job.message.from}`),
    p_request:request ? {id:request.id,body:await seal(request.body,'orbita-commerce-request-v1',`${job.tenantId}:${request.id}`)} : null});
  },
  async list(tenant) {
   const rows=await database.rpc('orbita_commerce_list',{p_tenant_id:tenant});
   return Promise.all(rows.map(async r=>({id:r.id,channelId:r.channel_id,status:r.status,revision:r.revision,orderId:r.order_id,
    createdAt:r.created_at,body:await open(r.body,'orbita-commerce-request-v1',`${tenant}:${r.id}`)})));
  },
  async conversations(tenant,channel,sender=null) {
   const rows=await database.rpc('orbita_commerce_conversations',{p_tenant_id:tenant,p_channel_id:channel,p_sender:sender});
   return Promise.all(rows.map(async r=>{
    const message=await open(r.body,'orbita-inbound-v1',`${app}:${r.phone_number_id}:${r.provider_id}`);
    return {id:r.id,message,direction:r.direction,held:r.held,needsHuman:r.needs_human,delivery:r.delivery,
      reply:r.reply ? (await open(r.reply,'orbita-reply-v1',r.id)).reply : null};
   }));
  },
  async inbox(tenant) {
   const rows=await database.rpc('orbita_commerce_inbox',{p_tenant_id:tenant});
   return Promise.all(rows.map(async r=>({channelId:r.channel_id,held:r.held,needsHuman:r.needs_human,delivery:r.delivery,
     message:await open(r.body,'orbita-inbound-v1',`${app}:${r.phone_number_id}:${r.provider_id}`)})));
  },
  async reviewClaim(tenant,id,revision,owner,review) {
   const r=await database.rpc('orbita_commerce_review_claim',{p_tenant_id:tenant,p_request_id:id,p_revision:revision,p_owner:owner,
     p_review:await seal(review,'orbita-commerce-review-v1',`${tenant}:${id}`)});
   return {...r,body:await open(r.body,'orbita-commerce-request-v1',`${tenant}:${id}`),
    review:r.review_body ? await open(r.review_body,'orbita-commerce-review-v1',`${tenant}:${id}`) : null};
  }
 };
}
