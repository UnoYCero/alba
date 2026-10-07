import {createNetlifyRecovery} from '../../orbita-server/netlify-runtime.mjs';
export default async (request,context) => createNetlifyRecovery({env:process.env})(request,context);
export const config = {schedule:'* * * * *'};
