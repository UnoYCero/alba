import {getStore} from '@netlify/blobs';
import {createPlatformState,isPublishedProduction} from '../../orbita-server/netlify-runtime.mjs';
import {createPortalHandler} from '../../orbita-server/portal.mjs';
export default async(request,context)=>{
 if(process.env.ORBITA_PORTAL_ENABLED!=='true'||process.env.ORBITA_STATE_BACKEND!=='supabase'||!isPublishedProduction(context))
   return Response.json({error:'NOT_FOUND'},{status:404,headers:{'Cache-Control':'no-store'}});
 try{return await createPortalHandler({env:process.env,database:createPlatformState(process.env,getStore)})(request,context);}
 catch{return Response.json({error:'SERVICE_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
};
export const config={path:['/orbita/panel','/orbita/panel/*']};
