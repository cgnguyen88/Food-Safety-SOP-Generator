import { createClient } from '@supabase/supabase-js';
import { createShareHandler } from './shareHandler.js';
import { createLimiterSet } from './limiters.js';
import { createRateStore } from './rateStore.js';
import { sendJson } from './httpUtils.js';

const AUTH_OPTIONS = Object.freeze({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** People looking at a SOP page: plenty for a crew reading it on their phones. */
const READS_PER_MINUTE = 60;
/** People signing: a few a person an hour. */
const SIGN_OFFS_PER_HOUR = 10;
/** Sign-offs one link may collect in a day: a large crew, but not a flood. */
const SIGN_OFFS_PER_LINK_PER_DAY = 100;

/**
 * Wire the public SOP link endpoint from environment variables. In production it refuses everything unless limits
 * can be shared across server instances, because nobody is signed in and the limits are all that stands between the
 * link and a flood of fake sign-offs.
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ error: Function, warn: Function }} logger
 */
export function createDefaultShareHandler(env = process.env, logger = console) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const store = createRateStore(env);

  if (!store.shared && (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production')) {
    logger.error('[sop-share] SOP links are refused: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY so rate limits are shared.');
    return async function refuseWithoutSharedLimits(_req, res) {
      sendJson(res, 503, { error: 'This page is not available right now.' });
    };
  }
  if (!store.shared) logger.warn('[sop-share] Shared rate limits are off (no SUPABASE_SERVICE_ROLE_KEY): limits apply per server process only.');

  const limiters = createLimiterSet({ rate: { perMinute: 0, perDay: 0, globalPerDay: 0 }, prefix: 'share', store, shared: store.shared, logger });
  let admin = null;
  return createShareHandler({
    getAdmin: () => {
      if (!url || !serviceKey) return null;
      admin ??= createClient(url, serviceKey, { auth: AUTH_OPTIONS });
      return admin;
    },
    limiters: {
      read: limiters.single('read-min', READS_PER_MINUTE, MINUTE_MS),
      sign: limiters.single('sign-hour', SIGN_OFFS_PER_HOUR, HOUR_MS),
      signPerLink: limiters.single('sign-link-day', SIGN_OFFS_PER_LINK_PER_DAY, DAY_MS),
    },
    logger,
  });
}
