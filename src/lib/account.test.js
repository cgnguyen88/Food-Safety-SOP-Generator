import { describe, it, expect } from 'vitest';
import { buildSignUp, interpretSignUp, authErrorKey, loadAccount, PASSWORD_MIN } from './account.js';

const FORM = {
  role: 'fsm', firstName: ' Rosa ', lastName: 'Diaz', email: ' Rosa@Example.com ', phone: ' 555-0100 ', organization: ' Diaz Farms ',
  password: '  secret pass  ', confirm: '  secret pass  ', agreedTerms: true,
};

describe('buildSignUp', () => {
  it('trims the details, lower-cases the email and puts the profile in the sign-up metadata the database reads', () => {
    expect(buildSignUp(FORM)).toEqual({
      ok: true,
      payload: {
        email: 'rosa@example.com',
        password: '  secret pass  ',
        options: { data: { first_name: 'Rosa', last_name: 'Diaz', name: 'Rosa Diaz', phone: '555-0100', organization: 'Diaz Farms', farm_name: 'Diaz Farms', job_role: 'fsm' } },
      },
    });
  });

  it.each([
    ['a missing first name', { firstName: ' ' }, 'fillRequired'],
    ['a missing last name', { lastName: '' }, 'fillRequired'],
    ['a missing email', { email: '' }, 'fillRequired'],
    ['a missing organisation', { organization: '' }, 'fillRequired'],
    ['no role', { role: '' }, 'fillRequired'],
    ['a role that does not exist', { role: 'boss' }, 'fillRequired'],
    ['an email without @', { email: 'rosa.example.com' }, 'invalidEmail'],
    ['an email with spaces inside', { email: 'ro sa@example.com' }, 'invalidEmail'],
    ['a short password', { password: 'short', confirm: 'short' }, 'passwordLength'],
    ['passwords that differ', { confirm: 'something else' }, 'passwordMismatch'],
    ['terms not accepted', { agreedTerms: false }, 'acceptTerms'],
    ['an organisation over 120 characters', { organization: 'x'.repeat(121) }, 'tooLong'],
    ['a name over 80 characters', { firstName: 'x'.repeat(81) }, 'tooLong'],
    ['a phone over 40 characters', { phone: '1'.repeat(41) }, 'tooLong'],
  ])('refuses %s', (_label, change, code) => {
    expect(buildSignUp({ ...FORM, ...change })).toEqual({ ok: false, code });
  });

  it('allows an empty phone, and needs at least the minimum password length', () => {
    expect(buildSignUp({ ...FORM, phone: '' }).ok).toBe(true);
    const exact = 'p'.repeat(PASSWORD_MIN);
    expect(buildSignUp({ ...FORM, password: exact, confirm: exact }).ok).toBe(true);
    expect(PASSWORD_MIN).toBeGreaterThanOrEqual(8);
  });
});

describe('interpretSignUp', () => {
  it('is signed in only with a session; without one the email must be confirmed first', () => {
    expect(interpretSignUp({ user: { email: 'a@b.c' }, session: {} })).toEqual({ kind: 'signed-in' });
    expect(interpretSignUp({ user: { email: 'a@b.c' }, session: null })).toEqual({ kind: 'confirm-email', email: 'a@b.c' });
    expect(interpretSignUp({ user: null })).toEqual({ kind: 'failed' });
    expect(interpretSignUp(undefined)).toEqual({ kind: 'failed' });
  });
});

describe('authErrorKey', () => {
  it.each([
    [{ message: 'Invalid login credentials', code: 'invalid_credentials' }, 'invalidCredentials'],
    [{ message: 'User already registered', code: 'user_already_exists' }, 'emailExists'],
    [{ message: 'Email not confirmed', code: 'email_not_confirmed' }, 'emailNotConfirmed'],
    [{ message: 'Password should be at least 6 characters', code: 'weak_password' }, 'weakPassword'],
    [{ message: 'Request rate limit reached', status: 429 }, 'tooManyAttempts'],
    [{ message: 'Failed to fetch', name: 'AuthRetryableFetchError' }, 'networkError'],
    [{ message: 'captcha protection: request disallowed (invalid-input-response)' }, 'captchaFailed'],
    [{ message: 'Something unexpected' }, 'genericError'],
    [null, 'genericError'],
  ])('maps %j to %s', (error, key) => {
    expect(authErrorKey(error)).toBe(key);
  });
});

describe('loadAccount', () => {
  function fakeClient({ farmId = 'farm-1', rpcError = null, farm = { id: 'farm-1', name: 'Diaz Farms', farm_code: 'F-ABC234' }, role = 'owner', profile = { first_name: 'Rosa', last_name: 'Diaz', organization: 'Diaz Farms', job_role: 'fsm', phone: null } } = {}) {
    const tables = {
      farms: { data: farm, error: null },
      farm_members: { data: role ? { role } : null, error: null },
      profiles: { data: profile, error: null },
    };
    const filters = [];
    return {
      filters,
      rpc: async (fn) => (fn === 'ensure_my_farm' ? { data: rpcError ? null : farmId, error: rpcError } : { data: null, error: { message: 'unknown' } }),
      from: (table) => {
        const query = {
          select: () => query,
          eq: (column, value) => { filters.push([table, column, value]); return query; },
          maybeSingle: async () => tables[table],
        };
        return query;
      },
    };
  }

  it("makes sure the person has a farm, then reads the farm, their role and their profile", async () => {
    const client = fakeClient();
    const account = await loadAccount(client, { id: 'user-1', email: 'rosa@example.com' });
    expect(account).toEqual({
      farmId: 'farm-1',
      farm: { id: 'farm-1', name: 'Diaz Farms', farm_code: 'F-ABC234' },
      role: 'owner',
      user: { id: 'user-1', email: 'rosa@example.com', name: 'Rosa Diaz', firstName: 'Rosa', lastName: 'Diaz', organization: 'Diaz Farms', jobRole: 'fsm', phone: '' },
    });
    expect(client.filters).toContainEqual(['farm_members', 'user_id', 'user-1']);
    expect(client.filters).toContainEqual(['profiles', 'id', 'user-1']);
  });

  it('falls back to the email for the name when there is no profile yet', async () => {
    const account = await loadAccount(fakeClient({ profile: null }), { id: 'user-1', email: 'rosa@example.com' });
    expect(account.user).toMatchObject({ name: 'rosa', organization: 'Diaz Farms' });
  });

  it('fails clearly when the farm cannot be set up', async () => {
    await expect(loadAccount(fakeClient({ rpcError: { message: 'boom' } }), { id: 'u', email: 'e@x.y' })).rejects.toThrow(/could not load your farm/i);
  });
});
