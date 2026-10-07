import {getStore} from '@netlify/blobs';
import {createNetlifyRecovery} from '../../orbita-server/netlify-runtime.mjs';
export default async (request,context) => createNetlifyRecovery({env:process.env,getStore})(request,context);
export const config = {schedule:'* * * * *'};
