import Anthropic from '@anthropic-ai/sdk';
import { loadConfig, resolveAnthropicKey } from '../config.js';
import { createAgentStore } from './supabaseStore.js';
import { createAgentLimiters } from '../limiters.js';
import { createTelegramHandler } from '../channels/createTelegramHandler.js';

/**
 * Wire the Telegram records bot from environment variables. Call after the environment is loaded (dotenv in dev;
 * the platform injects it on Vercel).
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ error: Function, warn: Function, info: Function }} logger
 * @returns {{ telegram: Function }}
 */
export function createAgentHandlers(env = process.env, logger = console) {
  const config = loadConfig(env);
  const { key, warning } = resolveAnthropicKey(env);
  if (warning) logger.warn(`[agent] ${warning}`);

  if (env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('[agent] VITE_SUPABASE_SERVICE_ROLE_KEY is set. Variables with the VITE_ prefix are bundled into the browser build and are public, and the service-role key bypasses every row-level security policy. Rotate that key in the Supabase dashboard now and store the replacement as SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix).');
  }
  for (const name of ['VITE_TELEGRAM_BOT_TOKEN', 'VITE_TELEGRAM_WEBHOOK_SECRET']) {
    if (env[name]) logger.warn(`[agent] ${name} is set. Variables with the VITE_ prefix are bundled into the browser build and are public. Revoke the bot token with @BotFather (/revoke) and store the new one as ${name.replace('VITE_', '')} (no VITE_ prefix).`);
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('[agent] SUPABASE_SERVICE_ROLE_KEY is not set: the Telegram bot cannot find linked accounts or save records until it is (server-side only, never VITE_).');
  }

  const anthropic = key ? new Anthropic({ apiKey: key }) : null;
  const store = createAgentStore(env);
  const limiters = createAgentLimiters({
    config,
    store,
    // Shared counts need the server role (the limit table is closed to everyone else).
    shared: Boolean(env.SUPABASE_SERVICE_ROLE_KEY && (env.SUPABASE_URL || env.VITE_SUPABASE_URL)),
    logger,
  });

  return {
    telegram: createTelegramHandler({ env, config, anthropic, agentStore: store, limiters, logger }),
  };
}
