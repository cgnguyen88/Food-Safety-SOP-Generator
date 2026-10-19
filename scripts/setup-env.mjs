#!/usr/bin/env node
/**
 * Writes the keys this app needs into .env.local, asking for each one at a hidden prompt so nothing
 * appears on screen, in the shell history or in a chat. Run it in your own terminal:
 *
 *   npm run setup:env
 *
 * Press Enter at a prompt to keep the value already in .env.local. Values are never printed.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS, BROWSER_COPIES, UNSAFE_NAMES, mergeEnv, removeNames, namesIn } from './envFile.mjs';
import { ask } from './prompt.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = join(ROOT, '.env.local');
const ENV = join(ROOT, '.env');

async function main() {
  if (!process.stdin.isTTY) {
    console.error('Run this in a terminal: it asks for each key at a hidden prompt.');
    process.exit(1);
  }
  const current = existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, 'utf8') : '';
  const known = new Set(namesIn(current));
  const updates = {};

  console.info('Setting up .env.local for the Food Safety SOP app. What you type is not shown.\n');
  for (const setting of SETTINGS) {
    const keep = known.has(setting.name) ? ' (Enter keeps the current value)' : ' (Enter skips it)';
    for (;;) {
      const value = await ask(`${setting.prompt}${keep}:\n> `, { hidden: setting.secret });
      if (value === '') break;
      const verdict = setting.check(value);
      if (verdict === true) {
        updates[setting.name] = value;
        if (BROWSER_COPIES[setting.name]) updates[BROWSER_COPIES[setting.name]] = value;
        break;
      }
      console.info(`  Not saved: ${verdict}. Try again, or press Enter to skip.`);
    }
  }

  if (Object.keys(updates).length) {
    // Make an existing file private before the keys go in (the mode option only applies to a new file).
    if (existsSync(ENV_LOCAL)) chmodSync(ENV_LOCAL, 0o600);
    writeFileSync(ENV_LOCAL, mergeEnv(current, updates), { mode: 0o600 });
    chmodSync(ENV_LOCAL, 0o600);
    console.info(`\nSaved ${Object.keys(updates).length} setting(s) to .env.local (readable by you only; git ignores it).`);
  } else {
    console.info('\nNothing changed.');
  }

  if (existsSync(ENV)) {
    const envText = readFileSync(ENV, 'utf8');
    const unsafe = namesIn(envText).filter((name) => UNSAFE_NAMES.includes(name));
    if (unsafe.length) {
      console.info(`\n.env holds ${unsafe.join(', ')}. The app no longer uses them, and a VITE_ name can end up in the browser build.`);
      console.info('Rotate (replace) those keys at their providers: the old app used them in ways that could expose them.');
      const answer = await ask('Remove those lines from .env now? [y/N] ');
      if (/^y(es)?$/i.test(answer)) {
        writeFileSync(ENV, removeNames(envText, unsafe));
        console.info('Removed.');
      }
    }
  }

  const migrations = readdirSync(join(ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  console.info('\nNext:');
  console.info('  1. In the Supabase dashboard, open SQL Editor and run each file below, in this order:');
  for (const file of migrations) console.info(`       supabase/migrations/${file}`);
  console.info('  2. npm run dev   (opens the app; the API runs alongside it)');
}

main().catch((error) => {
  console.error(`Setup stopped: ${error.message}`);
  process.exit(1);
});
