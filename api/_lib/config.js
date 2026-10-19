/**
 * Server-side configuration for the Claude proxy. Everything here is read from
 * environment variables on the server; nothing is controllable by the client.
 */

// Sonnet: fast and inexpensive for chat and form suggestions. Override with ANTHROPIC_MODEL.
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const HARD_MAX_OUTPUT_TOKENS = 16_000;
// A long SOP chat fits easily; far more would only make each request expensive.
const DEFAULT_MAX_INPUT_CHARS = 60_000;
const DEFAULT_MAX_MESSAGES = 40;
// The farm profile and an SOP's form values; the prompt builder trims them further.
const DEFAULT_MAX_CONTEXT_CHARS = 60_000;
const BODY_OVERHEAD_BYTES = 262_144; // JSON framing, role/type keys
const DEFAULT_RATE_PER_MINUTE = 20;
const DEFAULT_RATE_PER_DAY = 200;
const DEFAULT_GLOBAL_PER_DAY = 5000;
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = process.env) {
  const limits = Object.freeze({
    maxMessages: positiveInt(env.AI_MAX_MESSAGES, DEFAULT_MAX_MESSAGES),
    maxTotalChars: positiveInt(env.AI_MAX_INPUT_CHARS, DEFAULT_MAX_INPUT_CHARS),
    maxContextChars: positiveInt(env.AI_MAX_CONTEXT_CHARS, DEFAULT_MAX_CONTEXT_CHARS),
  });

  return Object.freeze({
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    maxOutputTokens: Math.min(positiveInt(env.AI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS), HARD_MAX_OUTPUT_TOKENS),
    requestTimeoutMs: positiveInt(env.AI_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    rate: Object.freeze({
      perMinute: positiveInt(env.AI_RATE_LIMIT_PER_MIN, DEFAULT_RATE_PER_MINUTE),
      perDay: positiveInt(env.AI_RATE_LIMIT_PER_DAY, DEFAULT_RATE_PER_DAY),
      globalPerDay: positiveInt(env.AI_RATE_LIMIT_GLOBAL_PER_DAY, DEFAULT_GLOBAL_PER_DAY),
    }),
    limits,
    // HTTP body cap for servers that parse JSON themselves (the local Express dev server).
    bodyLimitBytes: limits.maxTotalChars + limits.maxContextChars + BODY_OVERHEAD_BYTES,
  });
}

/**
 * Pick the Anthropic API key. `VITE_`-prefixed variables are inlined into the
 * browser bundle by Vite, so a key stored that way is public: it is never used,
 * and its presence produces a warning telling the operator to rotate it.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ key: string | null, warning: string | null }}
 */
export function resolveAnthropicKey(env = process.env) {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || null;
  const warning = env.VITE_ANTHROPIC_API_KEY
    ? 'VITE_ANTHROPIC_API_KEY is set. Variables with the VITE_ prefix are bundled into the browser build and are public, so it is ignored. Rotate that key in the Anthropic console and store the replacement as ANTHROPIC_API_KEY (no VITE_ prefix).'
    : null;
  return { key, warning };
}
