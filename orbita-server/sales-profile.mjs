const safeText=(value,max=2000)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008]/.test(value);
export function salesProfile(env,tenantId){
 let profiles;try{profiles=JSON.parse(env.ORBITA_SALES_PROFILES||'{}');}catch{throw Error('SALES_PROFILE_INVALID');}
 const p=profiles[tenantId];if(!p)return null;
 if(p.version!==1||!['test','production'].includes(p.mode)||!safeText(p.businessName,80)||(p.ownerName!==undefined&&!safeText(p.ownerName,80))||!Array.isArray(p.branches)||!p.branches.length||p.branches.length>10||
  !p.branches.every(b=>/^[a-z0-9_-]{1,40}$/.test(b.id)&&safeText(b.name,80)&&Array.isArray(b.aliases)&&b.aliases.every(a=>safeText(a,80)))||
  new Set(p.branches.map(b=>b.id)).size!==p.branches.length||!p.faq||typeof p.faq!=='object'||Array.isArray(p.faq)||
  Object.values(p.capabilities||{}).some(v=>typeof v!=='boolean')||
  !Object.values(p.faq).every(v=>safeText(v))||JSON.stringify(p).length>12000)throw Error('SALES_PROFILE_INVALID');
 return p;
}
export const normalize=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
export function explicitCity(text,branches){
 const t=normalize(text),found=branches.filter(b=>[b.id,b.name,...b.aliases].some(v=>{
  const s=normalize(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:^|\\b)${s}(?:$|\\b)`).test(t);
 }));return found.length===1?found[0].id:null;
}
export function cityHint(phone,branches){
 const digits=String(phone).replace(/\D/g,'');
 const id=/^525[56]/.test(digits)?'cdmx':/^52999/.test(digits)?'merida':null;
 return branches.some(b=>b.id===id)?id:null;
}
export function cityQuestion(profile,phone){const hint=cityHint(phone,profile.branches),branch=profile.branches.find(b=>b.id===hint);
 return branch?`¿La entrega sería en ${branch.name}?`:'¿En qué ciudad necesitas la entrega?';}
export function publicSalesFacts(profile,branchId){
 const b=profile.branches.find(b=>b.id===branchId);
 return {businessName:profile.businessName,mode:profile.mode,faq:profile.faq,
  branch:b?{id:b.id,name:b.name,address:b.address||null,deliveryDays:b.deliveryDays||null,coverage:b.coverage||[]}:null,
  rules:{additionalDishes:true,removePackageDishes:false,paymentProofNeedsHumanReview:true}};
}
