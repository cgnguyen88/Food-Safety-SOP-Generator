# FarmSafe: Food Safety SOP Assistant

A bilingual (English/Spanish) web app that helps California farms keep their food safety records (sanitation, field
and environment, people, harvest and traceability), stay ahead of what needs attention, and write their FSMA Produce
Safety Rule SOPs and Farm Food Safety Plan, with an AI advisor ("Jimmy") built on Claude.

Plans for records, Telegram capture, traceability and SOP QR codes: [docs/PLAN-records-telegram-qr.md](docs/PLAN-records-telegram-qr.md).

## How it fits together

| Part | Where | What it does |
|---|---|---|
| Browser app | `src/` (React 19, Vite) | Sign-in, home, records, fields, water assessments, training due, trace, reports, SOP editor, plan generator, chat |
| Accounts and data | Supabase (Auth + Postgres with row-level security) | One farm per account; owners, managers and crew; the farm's shared data |
| AI endpoint | `api/claude.js` (Vercel function), `server/index.js` (the same code locally) | Signed-in users only, rate-limited; the server owns every instruction sent to Claude |
| SOP links for workers | `api/sop-share.js` (same code locally) | A QR code or link per SOP: workers read it without signing in and sign that they read it (a training record waiting for approval). Links are long random tokens an owner or manager can turn off; every request is rate-limited |
| Database changes | `supabase/migrations/*.sql` | Tables, policies and functions, tested with PGlite in `supabase/*.test.js` |

The browser never chooses the model or the instructions: it sends a mode (`assistant`, `sop_chat`, `sop_field`,
`plan_section`) and a little context, and `api/_lib/modes.js` builds the request from the server's own
copy of the SOPs.

## First-time setup

1. `npm install`
2. Create a Supabase project. In **SQL Editor**, run each file in `supabase/migrations/` in name order.
3. In **Authentication → URL Configuration**, set the Site URL to where the app runs (for example
   `http://localhost:5173` while developing, then the Vercel address).
4. Run `npm run setup:env` in your terminal. It asks for the Supabase URL and keys and the Anthropic API key at hidden
   prompts and writes `.env.local` (git-ignored). Set a monthly spend limit on the Anthropic key.
5. `npm run dev` starts the app on http://localhost:5173 and the API on port 3002.

When an owner or manager signs in on a browser that still holds data from the old browser-only version, the app offers
to copy it into their farm; nothing is copied unless they agree, and a backup stays in the browser for 30 days.

## Telegram bot

Workers can send a photo (a cleaning sheet, a sanitizer label, a lab report) or a message, in English or Spanish, and the
bot files it as records in **Needs review**. Nothing the bot files is ever approved, and illness and injury reports can only
be filed by owners and managers.

1. In Telegram, ask **@BotFather** for a bot (`/newbot`) and keep its token private.
2. Run the two Telegram migrations in `supabase/migrations/` (`…channels.sql` and `…record_files_bucket.sql`).
3. Run `npm run setup:env`: it asks for the bot token (hidden) and the bot's username, and makes the webhook secret itself.
4. **Try it on your own computer:** `npm run dev`, then in a second terminal `npm run telegram:poll -- --yes`.
5. In the app, open **Home → Connect Telegram**, tap **Open Telegram**, press **Start** and answer **YES**.
6. **Deployed:** add the same variables in Vercel, then `npm run telegram:webhook -- --url https://YOUR-APP/api/agent/telegram --yes`.

Only connected accounts can use the bot; anyone else gets a fixed "how to connect" reply and costs nothing. Each photo or
message is one model call, limited per person and per day (`AGENT_RATE_LIMIT_*`).

## Keeping it safe

- **Rotate old keys.** The old version used `VITE_ANTHROPIC_API_KEY` and `OPENROUTER_KEY` in ways that could expose
  them, and a Google API key appears in this repository's git history. Replace (rotate) each of them at its provider and
  remove them from Vercel. `npm run setup:env` offers to delete the lines from `.env`.
- **Turn on CAPTCHA for sign-up** (Supabase → Authentication → Attack Protection, Cloudflare Turnstile), and set
  `VITE_CAPTCHA_PROVIDER` and `VITE_CAPTCHA_SITE_KEY`. Without it one person can open many accounts to use the AI.
- **Set a monthly spend limit** on the Anthropic key.
- In production the AI endpoint refuses every request unless `SUPABASE_SERVICE_ROLE_KEY` is set, because its rate limits
  must be shared by every server instance.
- Two devices editing at once cannot overwrite each other: every save names the version it replaces, and a clash is
  merged and saved again.
- `vercel.json` sets security headers. The Content Security Policy is in report-only mode until it has been checked on
  the live site (look for CSP warnings in the browser console), then it can be enforced.

## Deploying on Vercel

Add the same variables as `.env.example` in the Vercel project (Settings → Environment Variables). Only the two
`VITE_SUPABASE_*` values are public; everything else is server-only and must not have a `VITE_` prefix.

## Photos

The pictures in `public/photos/` (the researcher on the home page, the produce on the Records page, the phone with a QR code on the SOPs page) are from [Unsplash](https://unsplash.com), used under the [Unsplash License](https://unsplash.com/license). They are kept inside the app, resized, so no page loads an image from another site.

## Tests

```bash
npm test
```

`npm test` runs the database tests (a real Postgres in memory), the API tests and the browser tests. `npm run build`
checks the production build.
