export async function verifyDurableMetaCredential(credentials, channel, env, fetcher=fetch) {
  const token = credentials.metaAccessToken;
  if (!token || !env.ORBITA_META_APP_ID || !env.ORBITA_META_APP_SECRET) throw new Error('META_CREDENTIAL_MISSING');
  async function read(url, authorization) {
    const response = await fetcher(url,{redirect:'error',headers:{Authorization:`Bearer ${authorization}`},signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('META_CREDENTIAL_NOT_VERIFIED');
    return response.json();
  }
  const info = (await read(`https://graph.facebook.com/v25.0/debug_token?input_token=${encodeURIComponent(token)}`,
    `${env.ORBITA_META_APP_ID}|${env.ORBITA_META_APP_SECRET}`))?.data;
  if (info?.is_valid !== true || String(info.app_id)!==env.ORBITA_META_APP_ID || info.expires_at!==0 ||
    (info.data_access_expires_at !== undefined && info.data_access_expires_at !== 0) ||
    !info.scopes?.includes('whatsapp_business_messaging') || !info.scopes?.includes('whatsapp_business_management')) throw new Error('META_DURABLE_CREDENTIAL_REQUIRED');
  const phones = await read(`https://graph.facebook.com/v25.0/${channel.wabaId}/phone_numbers?fields=id&limit=100`,token);
  if (!phones?.data?.some(phone=>String(phone.id)===channel.phoneNumberId)) throw new Error('META_ASSET_NOT_OWNED');
  if (channel.coexistence===true) {
    const phone=await read(`https://graph.facebook.com/v26.0/${channel.phoneNumberId}?fields=id,is_on_biz_app,platform_type,display_phone_number`,token);
    if (String(phone.id)!==channel.phoneNumberId || phone.is_on_biz_app!==true || phone.platform_type!=='CLOUD_API') throw new Error('META_COEXISTENCE_NOT_VERIFIED');
    return {...credentials,coexistence:true,businessPhone:phone.display_phone_number,tokenExpiresAt:0,tokenVerifiedAt:new Date().toISOString()};
  }
  return {...credentials,tokenExpiresAt:0,tokenVerifiedAt:new Date().toISOString()};
}
