const PREFIX='ORBITA_IMAGE_V1\n';
function imageUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.hostname.includes('.')&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)&&value.length<=1200;}catch{return false;}}
export function menuImageReply(url,caption){
 if(!imageUrl(url)||caption.length>1000)return caption;
 return PREFIX+JSON.stringify({link:url,caption});
}
export function outboundReply(reply){
 if(typeof reply!=='string'||!reply.length)throw Error('REPLY_INVALID');
 if(reply.startsWith(PREFIX)){
  let image;try{image=JSON.parse(reply.slice(PREFIX.length));}catch{throw Error('REPLY_INVALID');}
  if(!imageUrl(image?.link)||typeof image.caption!=='string'||image.caption.length>1000||Object.keys(image).some(k=>!['link','caption'].includes(k)))throw Error('REPLY_INVALID');
  return {type:'image',image};
 }
 return {type:'text',text:{preview_url:false,body:reply.slice(0,4000)}};
}
export function replyText(reply){return outboundReply(reply).image?.caption||reply;}
