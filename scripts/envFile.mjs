/**
 * Helpers for scripts/setup-env.mjs: checking what was typed and writing it into an env file
 * without disturbing the other lines. Nothing here prints a value.
 */

const SUPABASE_URL = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const JWT = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

/** What each setting must look like, and how to explain a mistake. */
export const SETTINGS = Object.freeze([
  {
    name: 'SUPABASE_URL',
    prompt: 'Supabase project URL (Project Settings → Data API, like https://abcd….supabase.co)',
    secret: false,
    check: (v) => SUPABASE_URL.test(v) || 'It should look like https://<20 letters and digits>.supabase.co',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    prompt: 'Supabase publishable key (sb_publishable_…) or legacy anon key (eyJ…)',
    secret: true,
    check: (v) => /^sb_publishable_[\w-]{10,}$/.test(v) || JWT.test(v) || 'It should start with sb_publishable_ or eyJ',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    prompt: 'Supabase secret key (sb_secret_…) or legacy service_role key (eyJ…). Server only, never shared',
    secret: true,
    check: (v) => /^sb_secret_[\w-]{10,}$/.test(v) || JWT.test(v) || 'It should start with sb_secret_ or eyJ',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    prompt: 'Anthropic API key (sk-ant-…). Set a monthly spend limit in the Anthropic console',
    secret: true,
    check: (v) => /^sk-ant-[\w-]{20,}$/.test(v) || 'It should start with sk-ant-',
  },
  {
    name: 'TELEGRAM_BOT_TOKEN',
    prompt: 'Telegram bot token from @BotFather (looks like 123456789:ABC…). Server only, never shared',
    secret: true,
    check: (v) => /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(v) || 'It should look like 123456789:ABC… (digits, a colon, then letters and digits)',
  },
  {
    name: 'VITE_TELEGRAM_BOT_USERNAME',
    prompt: 'The bot’s username, the part ending in bot (public; it is shown to people so they can open the bot)',
    secret: false,
    check: (v) => /^@?[A-Za-z0-9_]{5,32}$/.test(v) || 'It should be 5 to 32 letters, digits or underscores (for example farmsafe_records_bot)',
  },
]);

/** Telegram sends this back with every message so the app can tell Telegram's calls from anyone else's. Made here, never typed. */
export const WEBHOOK_SECRET_NAME = 'TELEGRAM_WEBHOOK_SECRET';

/** Names the browser build may see: the URL and the publishable key are public by design. */
export const BROWSER_COPIES = Object.freeze({ SUPABASE_URL: 'VITE_SUPABASE_URL', SUPABASE_ANON_KEY: 'VITE_SUPABASE_ANON_KEY' });

/** Names that must never be in an env file the browser build reads. */
export const UNSAFE_NAMES = Object.freeze(['VITE_ANTHROPIC_API_KEY', 'OPENROUTER_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_TELEGRAM_BOT_TOKEN', 'VITE_TELEGRAM_WEBHOOK_SECRET']);

const LINE_NAME = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/** The names set in an env file. */
export function namesIn(text) {
  return text.split(/\r?\n/).map((line) => LINE_NAME.exec(line)?.[1]).filter(Boolean);
}

/** An env value written so dotenv and Vite read it back exactly. */
function quoted(value) {
  if (/[\r\n]/.test(value)) throw new Error('A value cannot contain a line break.');
  return /^[\w.:/@+-]*$/.test(value) ? value : `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The env file with `updates` written in: an existing line for a name is replaced in place, new names
 * go at the end, and every other line (comments included) is kept as it was.
 *
 * @param {string} text the current file ('' when there is none)
 * @param {Record<string, string>} updates
 * @returns {string}
 */
export function mergeEnv(text, updates) {
  const pending = new Map(Object.entries(updates));
  const lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
  const kept = lines.map((line) => {
    const name = LINE_NAME.exec(line)?.[1];
    if (!name || !pending.has(name)) return line;
    const value = pending.get(name);
    pending.delete(name);
    return `${name}=${quoted(value)}`;
  });
  const added = [...pending].map(([name, value]) => `${name}=${quoted(value)}`);
  return `${[...kept, ...added].join('\n')}\n`;
}

/** The env file without the given names. */
export function removeNames(text, names) {
  const drop = new Set(names);
  const lines = text.replace(/\r?\n$/, '').split(/\r?\n/).filter((line) => !drop.has(LINE_NAME.exec(line)?.[1]));
  return lines.length ? `${lines.join('\n')}\n` : '';
}
