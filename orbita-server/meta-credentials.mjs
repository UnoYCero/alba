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
  return {...credentials,tokenExpiresAt:0,tokenVerifiedAt:new Date().toISOString()};
}
