import { describe, it, expect } from 'vitest';
import { SETTINGS, WEBHOOK_SECRET_NAME, mergeEnv, removeNames, namesIn } from './envFile.mjs';

const setting = (name) => SETTINGS.find((s) => s.name === name);

describe('SETTINGS checks', () => {
  it.each([
    ['SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co', true],
    ['SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co/', false],
    ['SUPABASE_URL', 'http://abcdefghijklmnopqrst.supabase.co', false],
    ['SUPABASE_URL', 'https://evil.example.com', false],
    ['SUPABASE_ANON_KEY', 'sb_publishable_abcdefghijklmnop', true],
    ['SUPABASE_ANON_KEY', 'eyJhbGciOi.eyJpc3MiOi.c2lnbmF0dXJl', true],
    ['SUPABASE_ANON_KEY', 'sb_secret_abcdefghijklmnop', false],
    ['SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_abcdefghijklmnop', true],
    ['SUPABASE_SERVICE_ROLE_KEY', 'sb_publishable_abcdefghijklmnop', false],
    ['ANTHROPIC_API_KEY', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz', true],
    ['ANTHROPIC_API_KEY', 'AIzaSyB-not-an-anthropic-key', false],
  ])('%s accepts %s: %s', (name, value, ok) => {
    expect(setting(name).check(value) === true).toBe(ok);
  });

  it('explains a mistake without repeating the value', () => {
    const message = setting('ANTHROPIC_API_KEY').check('my-secret-value');
    expect(typeof message).toBe('string');
    expect(message).not.toContain('my-secret-value');
  });
});

describe('mergeEnv', () => {
  it('replaces existing names in place, adds new ones at the end, and keeps comments and other lines', () => {
    const before = '# local settings\nAPI_PORT=3002\nSUPABASE_URL=https://old.supabase.co\n';
    expect(mergeEnv(before, { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', ANTHROPIC_API_KEY: 'sk-ant-x' })).toBe(
      '# local settings\nAPI_PORT=3002\nSUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\nANTHROPIC_API_KEY=sk-ant-x\n',
    );
  });

  it('starts a new file', () => {
    expect(mergeEnv('', { A: '1' })).toBe('A=1\n');
  });

  it('quotes values with spaces or quotes so they read back exactly, and refuses line breaks', () => {
    expect(mergeEnv('', { A: 'two words', B: 'say "hi"' })).toBe('A="two words"\nB="say \\"hi\\""\n');
    expect(() => mergeEnv('', { A: 'line\nbreak' })).toThrow(/line break/);
  });
});

describe('the Telegram settings', () => {
  const token = setting('TELEGRAM_BOT_TOKEN');
  const username = setting('VITE_TELEGRAM_BOT_USERNAME');

  it('asks for the bot token at a hidden prompt, and checks its shape without ever repeating it', () => {
    expect(token.secret).toBe(true);
    expect(token.check('123456789:AAEhBP0av18F7y6mQxLfQ2pT9sKZ_n-2sDk')).toBe(true);
    for (const bad of ['', 'abc', '123:short', '123456789:has space in it padded to be long enough', 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx']) {
      const verdict = token.check(bad);
      expect(typeof verdict, bad).toBe('string');
      expect(verdict).not.toContain(bad || '\u0000');
    }
  });

  it('asks for the bot’s public username in the open, with or without the @', () => {
    expect(username.secret).toBe(false);
    expect(username.check('farmsafe_records_bot')).toBe(true);
    expect(username.check('@farmsafe_records_bot')).toBe(true);
    for (const bad of ['', 'abc', 'has space bot', 'x'.repeat(33), 'bad-dash_bot']) expect(typeof username.check(bad), bad).toBe('string');
  });

  it('keeps the bot token out of the browser: only the username is a VITE_ name', () => {
    expect(SETTINGS.filter((s) => s.name.startsWith('VITE_')).map((s) => s.name)).toEqual(['VITE_TELEGRAM_BOT_USERNAME']);
    expect(token.name.startsWith('VITE_')).toBe(false);
    expect(WEBHOOK_SECRET_NAME).toBe('TELEGRAM_WEBHOOK_SECRET');
  });
});

describe('removeNames and namesIn', () => {
  it('drops only the named lines', () => {
    const text = 'VITE_ANTHROPIC_API_KEY=x\n# keep me\nOPENROUTER_KEY=y\nOTHER=z\n';
    expect(removeNames(text, ['VITE_ANTHROPIC_API_KEY', 'OPENROUTER_KEY'])).toBe('# keep me\nOTHER=z\n');
    expect(removeNames('A=1\n', ['A'])).toBe('');
  });

  it('lists the names set in a file, ignoring comments', () => {
    expect(namesIn('# A=1\nB=2\nexport C=3\n\n')).toEqual(['B', 'C']);
  });
});
