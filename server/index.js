import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import { createDefaultHandler } from '../api/_lib/createDefaultHandler.js';
import { createDefaultShareHandler } from '../api/_lib/createShareHandler.js';
import { createAgentHandlers } from '../api/_lib/agent/createAgentHandlers.js';
import { loadConfig } from '../api/_lib/config.js';

// Load .env.local for development. Must run before the handler reads the environment.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local'), quiet: true });

const HOST = process.env.API_HOST || '127.0.0.1';
const PORT = Number(process.env.API_PORT) || 3002;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: loadConfig(process.env).bodyLimitBytes }));

// The same handler Vercel runs in production (api/claude.js).
app.all('/api/claude', createDefaultHandler());
app.all('/api/sop-share', createDefaultShareHandler());
// The Telegram bot's webhook (the same code runs on Vercel as api/agent/telegram.js).
app.all('/api/agent/telegram', createAgentHandlers().telegram);

// JSON errors only: no stack traces or HTML error pages.
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error('[api] unexpected error:', err?.name ?? 'unknown');
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, HOST, () => {
  console.info(`Food Safety SOP API running on http://${HOST}:${PORT}`);
  console.info(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET (run npm run setup:env)'}`);
  console.info(`  Supabase sign-in:  ${process.env.SUPABASE_URL ? 'configured' : 'NOT CONFIGURED (AI requests will be refused)'}`);
  console.info(`  Telegram bot:      ${process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET ? 'configured' : 'not set up (optional)'}`);
  console.info(`  Shared limits:     ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'on' : 'off (per-process limits only)'}`);
});
