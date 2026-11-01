import * as jev from './jev.mjs';
import * as openai from './openai.mjs';
import {salesProfile} from './sales-profile.mjs';
export function classificationConfig(env){
 const provider=env.ORBITA_AI_PROVIDER||'jev';
 if(provider==='jev')return {provider,model:jev.MODEL,
  estimate:(text,name)=>new TextEncoder().encode(JSON.stringify(jev.intentRequest(text,name))).length+512,
  reserve:(id,owner,tokens)=>({name:'orbita_reserve_usage',parameters:{p_message_id:id,p_owner:owner,p_tokens:tokens}}),
  classify:(text,name,fetcher)=>jev.classify(text,name,env.ORBITA_TYPESAFE_API_KEY,fetcher)};
 if(provider==='openai')return {provider,model:openai.MODEL,estimate:openai.estimateInputTokens,
  reserve:(id,owner,tokens)=>({name:'orbita_reserve_openai_usage',parameters:{p_message_id:id,p_owner:owner,p_input_tokens:tokens,p_output_tokens:openai.MAX_OUTPUT_TOKENS}}),
  classify:(text,name,fetcher)=>openai.classify(text,name,env.ORBITA_OPENAI_API_KEY,fetcher)};
 throw new Error('AI_PROVIDER_INVALID');
}
export function presentAgentSummary(summary,env){
 const ai=classificationConfig(env);
 return {...summary,costBasis:'Estimación de IA: entrada de Jev y entrada/salida de OpenAI; excluye WhatsApp, alojamiento y facturación comercial.',
  tenants:summary.tenants.map(t=>{const profile=env.ORBITA_SALES_ENABLED==='true'&&ai.provider==='openai'?salesProfile(env,t.id):null;
   return {...t,agents:t.agents.map(a=>({...a,aiProvider:ai.provider,model:ai.model,
    ...(profile?{salesMode:profile.mode,pendingSetup:profile.pending||[],registrationReady:profile.mode==='production'&&!!profile.capabilities?.registration,ordersReady:profile.mode==='production'&&!!profile.capabilities?.orders}:{} )}))};})};
}
