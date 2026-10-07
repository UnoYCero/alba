const encoder = new TextEncoder();
export function canonicalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^521\d{10}$/.test(digits) ? '52' + digits.slice(3) : digits;
}
export async function equalSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(left)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(right)));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export async function validSignature(bytes, header, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(header || '')) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
  const signature = Uint8Array.from(header.slice(7).match(/../g), pair => parseInt(pair, 16));
  return crypto.subtle.verify('HMAC', key, signature, bytes);
}
function toBase64(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return btoa(text);
}
function fromBase64(text) { return Uint8Array.from(atob(text), char => char.charCodeAt(0)); }
async function credentialKey(hex) {
  if (!/^[a-f0-9]{64}$/i.test(hex || '')) throw new Error('CREDENTIAL_KEY_MISSING');
  return crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), value => parseInt(value,16)), 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function sealCredentials(data, secret, tenantId, channelId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:encoder.encode(`${tenantId}/${channelId}`)}, await credentialKey(secret), encoder.encode(JSON.stringify(data)));
  return JSON.stringify({version:1, iv:toBase64(iv), ciphertext:toBase64(new Uint8Array(ciphertext))});
}
export async function openCredentials(value, secret, tenantId, channelId) {
  const envelope = JSON.parse(value);
  if (envelope.version !== 1) throw new Error('CREDENTIAL_VERSION');
  const plaintext = await crypto.subtle.decrypt({name:'AES-GCM', iv:fromBase64(envelope.iv), additionalData:encoder.encode(`${tenantId}/${channelId}`)}, await credentialKey(secret), fromBase64(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
export async function boundedBody(request, limit = 262144) {
  if (Number(request.headers.get('content-length')) > limit) throw Object.assign(new Error('BODY_LIMIT'), {status:413});
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw Object.assign(new Error('BODY_LIMIT'), {status:413}); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return bytes;
}
