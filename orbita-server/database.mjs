const CLIENT_PROJECT = 'lajstcbseugkjmkasnjd';
export function createDatabase(env, fetcher = fetch) {
  const ref = env.ORBITA_PROJECT_REF;
  const url = env.ORBITA_SUPABASE_URL;
  if (!/^[a-z0-9]{20}$/.test(ref || '') || ref === CLIENT_PROJECT || url !== `https://${ref}.supabase.co` || !env.ORBITA_SUPABASE_SECRET_KEY) {
    throw new Error('ORBITA_DATABASE_NOT_CONFIGURED');
  }
  async function rpc(name, parameters) {
    if (!/^orbita_[a-z_]+$/.test(name)) throw new Error('RPC_NOT_ALLOWED');
    const key = env.ORBITA_SUPABASE_SECRET_KEY;
    const response = await fetcher(`${url}/rest/v1/rpc/${name}`, {method:'POST', redirect:'error',
      headers:{apikey:key, ...(key.startsWith('sb_secret_') ? {} : {Authorization:`Bearer ${key}`}), 'Content-Type':'application/json'},
      body:JSON.stringify(parameters), signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('DATABASE_OPERATION_FAILED');
    // PostgREST returns 204 for void functions after committing the write.
    // Parsing that empty body would turn a successful transition into a retry.
    if (response.status === 204) return null;
    return response.json();
  }
  return {rpc};
}
