# Plan: food safety records, Telegram capture, traceability and SOP QR codes

Status: Phase 0 built on branch `feat/accounts-and-secure-ai` (2026-10-18); Phases 1 to 5 not started. Built on branches, never straight on `main`.

## Decisions (from the owner)

| Topic | Decision |
|---|---|
| Backend | New Supabase project for this app; copy the Organic app's tested setup (login, farms, fields, records, review queue, Telegram) |
| Who sends to Telegram | Managers and invited workers (crew accounts); workers' records wait for a manager's approval |
| Spanish SOP pages | AI drafts the Spanish; the manager reads and edits it before the QR page shows it |
| Traceability | Lot code generator, trace back / trace forward, timed mock recall report (FSMA 204 key data elements can come later) |
| Field holds | A flood or wildlife record puts the field on hold; no lot code for it until a corrective action clears it |
| QR sign-off | Worker can sign "read and understood" on the QR page; it becomes a training record a supervisor must approve |
| AI | Claude for everything, behind one secured server endpoint (replaces OpenRouter gpt-oss-120b, which cannot read photos) |
| Record types | All four groups: sanitation, field & environment, people, harvest & traceability |

Defaults I chose (say if you want otherwise): illness and injury reports are visible to owners and managers only; records are
never deleted, only voided, and kept at least 2 years (FSMA PSR 21 CFR 112.167); a farm's existing browser data is imported
once into its account at first sign-in.

## What exists today (and must change)

- All data, including user accounts with plain-text passwords, lives in each browser's localStorage; there is a "bypass auth" test user.
- `api/claude.js` is an open proxy: no sign-in, the browser chooses model and instructions (OpenRouter key exposed to abuse).
- 10 SOPs in `src/data/sop-data.js`, each with form sections and a `log` (title + columns). Spanish covers template labels only
  (`src/i18n/sop-translations.js`), not the farm's own text. The share link puts the whole SOP in the URL (too long for a QR).
- No tests.

## Record kinds (first version)

| Group | Kind | Key fields | Links / rules |
|---|---|---|---|
| Sanitation | `sanitizer_label` (library) | product, EPA reg. no., active ingredient, approved uses (food-contact surface, produce wash), ppm min/max, contact time, PPE, label photo | referenced by logs |
| | `sanitizer_purchase` | product, supplier, lot, quantity, date, receipt photo | product → label |
| | `sanitation_log` | date, item/surface, field or area, method, sanitizer, ppm reading, test strip photo, by whom | pass/fail worked out from the label's ppm range |
| Field & environment | `weather_event` | type (flood, heavy rain, hail, smoke/ash, extreme heat, wind), date, fields, did water/ash reach the crop, photos | flood contact → field hold |
| | `wildlife_check` (pre-harvest) | field, evidence (Y/N), description, no-harvest zone, photos | evidence → field hold |
| | `soil_amendment` | type, supplier, lot, quantity, field, method, application date | clearance date from the interval |
| | `water_test` | sample date, source/location, lab, sample id, result (CFU/100 mL), limit, pass/fail, lab report photo | |
| People | `training` | date, people trained, SOP/topic, trainer, language, sign-off | annual refresher "due" list |
| | `visitor` | date, name, company, purpose, time in/out, hygiene briefing | |
| | `illness_injury` (restricted) | date, person, symptoms/injury, removed from produce contact, return date | owners/managers only |
| Harvest & traceability | `harvest` | date, field, crop, quantity, crew, lot code | lot code generator; blocked if field on hold |
| | `packing_cooling` | lot code(s), pack date, cooling method/temp, packed by | |
| | `shipment` | date, customer, lot codes, quantity, invoice | trace forward |
| | `corrective_action` | date, what happened, fields/lots affected, action, who verified, clears hold? | clears field holds |

## Phases

### Phase 0: foundation and security
Supabase auth (replace localStorage accounts and the bypass user), farms + members (owner / manager / crew), profiles,
RLS, test harness (Vitest + PGlite, as in the Organic app), secured `/api/claude` (signed-in users only, server-owned
prompts, rate limits, Anthropic), one-time import of browser data (SOP forms, incidents, activity records).

Done (2026-10-18): Supabase sign-up and sign-in (the bypass user and browser accounts are gone, and old browser
passwords are deleted on first load); farms, members and profiles with RLS; `farm_data` for the farm profile, incidents,
cost settings and SOP activity records, saved to the server as you work; one-time import of browser data with a
backup, offered rather than automatic; versioned saves with a merge when two devices clash; `/api/claude` for
signed-in users only, with server-owned prompts (farm data fenced off as information), rate limits that must be shared
in production, and Claude Sonnet; chat form changes applied only after the person approves them; AI answers shown as
formatted text instead of raw HTML; `npm run setup:env` for keys at hidden prompts. Reviewed by a code review and a
security review; their findings were fixed. Owner to do: `npm run setup:env`, rotate the old keys, turn on sign-up
CAPTCHA, enforce the CSP after checking the live site.

### Phase 1: records core
Copy the Organic records system (records + immutable revisions, Needs Review, logs, change history, CSV/Word reports,
fields registry such as A2, B2) and swap in the food safety kinds above, in English and Spanish.

### Phase 2: rules that connect records
Sanitizer label → sanitation log pass/fail; field holds and their clearing; training due list; lot code generator from the
farm's own format (SOP #9, tokens such as `{FARM}-{CROP}-{YYYYMMDD}-{FIELD}`, a suffix when a code would repeat);
trace back (lot → field, crew, inputs, bin sanitation, water tests) and trace forward (lot → customers); timed mock recall report.

### Phase 3: Telegram capture
Copy the Organic channel and agent code (two-step linking, review queue, photo reading), with tools for the food safety
kinds. A new bot for this app.

### Phase 4: SOPs on the server, Spanish, QR codes
SOPs stored per farm with versions; "Publish" makes an AI Spanish draft the manager edits and approves; a public page per
SOP (hard-to-guess, revocable link, always the latest published version, EN/ES switch); printable QR poster per SOP;
worker "read and understood" sign-off → training record in Needs Review.

### Phase 5: phone layout, polish, deploy
Reuse the Organic app's phone layout (top bar, slide-out menu, records as cards), docs, Vercel deploy.

## What the owner has to set up (Claude cannot create accounts)

1. A new Supabase project: URL, anon key and service-role key (enter keys at a hidden prompt, never in chat).
2. A new Telegram bot from @BotFather (name and username), for Phase 3.
3. An Anthropic API key with a monthly spend limit; later the same variables in Vercel.

## Risks

- Food safety records are compliance evidence: the review queue, void-not-delete and revision history are what make them trustworthy.
- AI-read values (ppm, CFU, dates) can be wrong: every captured record stays in Needs Review until a person approves it.
- Spanish for safety steps must be checked by a person before workers see it (hence the approval step).
- Health information (illness reports) must stay with owners and managers.
