const legacy={siteId:'aa3eb206-3126-4e99-bc91-46a4bb2d59d2',teamId:'6864502cf6cc9967e3dac6db',origin:'https://albavision.tech'};
const clientSites=new Set(['65a5b934-b331-48c4-b66a-fa9db3d59a12','3f695b44-f4e1-4d7f-a8a6-45794941b72e']);
export function deploymentTarget(env={}) {
 const siteId=env.ORBITA_NETLIFY_SITE_ID,teamId=env.ORBITA_NETLIFY_TEAM_ID,origin=env.ORBITA_PUBLIC_ORIGIN;
 if(!siteId&&!teamId&&!origin)return legacy;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(siteId||'')||clientSites.has(siteId.toLowerCase())||!/^[a-f0-9]{24}$/i.test(teamId||''))return null;
 try{const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.origin!==origin)return null;return {siteId,teamId,origin:url.origin};}catch{return null;}
}
export function publicOrigin(env={}) {return deploymentTarget(env)?.origin||null;}
