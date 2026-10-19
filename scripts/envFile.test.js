import { describe, it, expect } from 'vitest';
import { SETTINGS, mergeEnv, removeNames, namesIn } from './envFile.mjs';

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
