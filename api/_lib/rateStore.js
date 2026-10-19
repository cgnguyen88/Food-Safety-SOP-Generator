import { createClient } from '@supabase/supabase-js';

const AUTH_OPTIONS = Object.freeze({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });

/**
 * Shared (database-backed) rate limit counts. Server-only: it uses the service-role key, the caller
 * passes a subject it has already verified, and the limits are chosen by the server, never a client.
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ createClientImpl?: typeof createClient }} [deps]
 * @returns {{ shared: boolean, takeRateToken: (bucket: string, subject: string, max: number, windowSeconds: number) => Promise<{ allowed: boolean, retry_after_sec: number }> }}
 */
export function createRateStore(env = process.env, { createClientImpl = createClient } = {}) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  let admin = null;
  const asService = () => {
    if (!serviceKey) throw new Error('Shared rate limits need SUPABASE_SERVICE_ROLE_KEY on the server.');
    if (!url) throw new Error('Shared rate limits need SUPABASE_URL on the server.');
    admin ??= createClientImpl(url, serviceKey, { auth: AUTH_OPTIONS });
    return admin;
  };

  return {
    shared: Boolean(url && serviceKey),
    async takeRateToken(bucket, subject, max, windowSeconds) {
      const { data, error } = await asService().rpc('take_rate_token', { p_bucket: bucket, p_subject: subject, p_max: max, p_window_seconds: windowSeconds });
      if (error) throw Object.assign(new Error(error.message ?? 'Database error'), { code: error.code });
      if (typeof data?.[0]?.allowed !== 'boolean') throw new Error('The rate limit function returned no verdict.');
      return data[0];
    },
  };
}
