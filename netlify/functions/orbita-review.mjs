import {createReviewHandler} from '../../orbita-server/review.mjs';
export default async(request,context)=>createReviewHandler({env:process.env})(request,context);
export const config={path:'/orbita/review/*'};
