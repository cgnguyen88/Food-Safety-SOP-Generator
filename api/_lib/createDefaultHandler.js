import Anthropic from '@anthropic-ai/sdk';
import { createClaudeHandler } from './claudeHandler.js';
import { loadConfig, resolveAnthropicKey } from './config.js';
import { createSupabaseTokenVerifier } from './auth.js';
import { createLimiterSet } from './limiters.js';
import { createRateStore } from './rateStore.js';
import { sendJson } from './httpUtils.js';

/**
 * Wire the /api/claude handler from environment variables. Call this after the environment is
 * loaded (dotenv in development; the platform injects it on Vercel).
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ error: Function, warn: Function, info: Function }} logger
 */
export function createDefaultHandler(env = process.env, logger = console) {
  const config = loadConfig(env);
  const { key, warning } = resolveAnthropicKey(env);
  if (warning) logger.warn(`[claude-proxy] ${warning}`);

  const anthropic = key ? new Anthropic({ apiKey: key }) : null;
  const store = createRateStore(env);
  if (!store.shared) {
    // Per-process counts mean almost nothing on serverless (every instance counts from zero), so a
    // production deployment must not run the AI without the shared, database-backed limits.
    if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') {
      logger.error('[claude-proxy] AI requests are refused: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY so rate limits are shared.');
      return async function refuseWithoutSharedLimits(_req, res) {
        sendJson(res, 503, { error: 'The AI service is not available right now.' });
      };
    }
    logger.warn('[claude-proxy] Shared rate limits are off (no SUPABASE_SERVICE_ROLE_KEY): limits apply per server process only.');
  }
  const limiters = createLimiterSet({
    rate: config.rate,
    prefix: 'claude',
    store,
    shared: store.shared,
    logger,
  });

  return createClaudeHandler({
    config,
    verifyToken: createSupabaseTokenVerifier(env),
    getAnthropic: () => anthropic,
    ...limiters.forEndpoint('proxy'),
    globalLimiter: limiters.global,
    logger,
  });
}
