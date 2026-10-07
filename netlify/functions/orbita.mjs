import {getStore} from '@netlify/blobs';
import {createNetlifyHandler} from '../../orbita-server/netlify-runtime.mjs';
export default async (request,context) => createNetlifyHandler({env:process.env,getStore})(request,context);
export const config = {path:'/orbita/api/*'};
