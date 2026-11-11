import {createSankalpaConnector} from './sankalpa.mjs';
import {createCommerceConnector} from './commerce.mjs';
// Future write capabilities stay disabled until this contract exists in the
// business backend and has passed acceptance. No database service key crosses
// from the client's ERP into Orbita.
export function createSalesConnector(credentials,fetcher=fetch){
 const catalog=createSankalpaConnector(credentials,fetcher),commerce=createCommerceConnector(credentials,fetcher);
 const base='https://lajstcbseugkjmkasnjd.supabase.co/functions/v1/orbita-integration';
 async function call(path,body){
  const r=await fetcher(base+path,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${credentials.siteToken}`,'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('SALES_OPERATION_UNAVAILABLE');return r.json();
 }
 return {catalog:catalog.catalog,quote:commerce.quote,
  async extraOptions(branchId){const options=await commerce.options(branchId);if(!Array.isArray(options.extras))throw Error('EXTRAS_INVALID');return options.extras;},
  register:input=>call('/sales/register',input),createOrder:input=>call('/sales/orders',input),paymentLink:input=>call('/sales/payment-link',input)};
}
