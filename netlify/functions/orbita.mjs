import {createNetlifyHandler} from '../../orbita-server/netlify-runtime.mjs';
export default async (request,context) => {
 const getStore=process.env.ORBITA_STATE_BACKEND==='supabase'?undefined:(await import('@netlify/blobs')).getStore;
 return createNetlifyHandler({env:process.env,getStore})(request,context);
};
export const config = {path:'/orbita/api/*'};
