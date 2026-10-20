/**
 * Sign-up, sign-in and the signed-in person's farm. Supabase Auth holds the accounts; a database
 * trigger creates each new person's farm and profile from the sign-up metadata built here.
 */

/** Shorter passwords are refused before they reach Supabase (which may require more). */
export const PASSWORD_MIN = 8;
export const JOB_ROLES = Object.freeze(['owner', 'fsm', 'consultant', 'supervisor', 'other']);

// The same limits as the database (profiles and farms check constraints).
const MAX = { name: 80, phone: 40, organization: 120 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check the sign-up form and build the arguments for supabase.auth.signUp. The `code` of a refusal
 * is the key of its message in the translations (T[lang].auth).
 *
 * @returns {{ ok: true, payload: { email: string, password: string, options: { data: object } } }
 *   | { ok: false, code: 'fillRequired' | 'invalidEmail' | 'passwordLength' | 'passwordMismatch' | 'acceptTerms' | 'tooLong' }}
 */
export function buildSignUp(form) {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = form.email.trim().toLowerCase();
  const phone = form.phone.trim();
  const organization = form.organization.trim();
  const { password, confirm, role, agreedTerms } = form; // passwords are never trimmed

  if (!firstName || !lastName || !email || !organization || !JOB_ROLES.includes(role)) return { ok: false, code: 'fillRequired' };
  if (!EMAIL.test(email)) return { ok: false, code: 'invalidEmail' };
  if (firstName.length > MAX.name || lastName.length > MAX.name || phone.length > MAX.phone || organization.length > MAX.organization) {
    return { ok: false, code: 'tooLong' };
  }
  if (password.length < PASSWORD_MIN) return { ok: false, code: 'passwordLength' };
  if (password !== confirm) return { ok: false, code: 'passwordMismatch' };
  if (!agreedTerms) return { ok: false, code: 'acceptTerms' };

  return {
    ok: true,
    payload: {
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, name: `${firstName} ${lastName}`, phone, organization, farm_name: organization, job_role: role },
      },
    },
  };
}

/**
 * With email confirmation on, Supabase returns the new user but no session until the emailed link
 * is clicked, so the person must not be treated as signed in yet.
 *
 * @returns {{ kind: 'signed-in' } | { kind: 'confirm-email', email: string | undefined } | { kind: 'failed' }}
 */
export function interpretSignUp(data) {
  if (!data?.user) return { kind: 'failed' };
  return data.session ? { kind: 'signed-in' } : { kind: 'confirm-email', email: data.user.email };
}

/** The translation key (T[lang].auth) for an error from Supabase Auth. */
export function authErrorKey(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const code = error?.code;
  if (code === 'invalid_credentials' || message.includes('invalid login')) return 'invalidCredentials';
  if (code === 'user_already_exists' || message.includes('already registered')) return 'emailExists';
  if (code === 'email_not_confirmed' || message.includes('not confirmed')) return 'emailNotConfirmed';
  if (code === 'weak_password' || message.includes('password should')) return 'weakPassword';
  if (message.includes('captcha')) return 'captchaFailed';
  if (error?.status === 429 || message.includes('rate limit')) return 'tooManyAttempts';
  if (error?.name === 'AuthRetryableFetchError' || message.includes('fetch')) return 'networkError';
  return 'genericError';
}

async function single(query, what) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load your ${what}. Check your connection and reload the page.`);
  return data;
}

/**
 * Everything the app needs about the signed-in person: their farm (created now if it was missing),
 * their role on it and their profile.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ id: string, email?: string }} authUser
 */
export async function loadAccount(client, authUser) {
  const { data: farmId, error } = await client.rpc('ensure_my_farm');
  if (error || !farmId) throw new Error('Could not load your farm. Check your connection and reload the page.');

  const [farm, membership, profile] = await Promise.all([
    single(client.from('farms').select('id, name, farm_code, season_start_month, season_start_day').eq('id', farmId), 'farm'),
    single(client.from('farm_members').select('role').eq('farm_id', farmId).eq('user_id', authUser.id), 'farm'),
    single(client.from('profiles').select('first_name, last_name, phone, organization, job_role').eq('id', authUser.id), 'profile'),
  ]);

  const firstName = profile?.first_name ?? '';
  const lastName = profile?.last_name ?? '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || (authUser.email ?? '').split('@')[0];
  return {
    farmId,
    farm,
    role: membership?.role ?? null,
    user: {
      id: authUser.id,
      email: authUser.email ?? '',
      name,
      firstName,
      lastName,
      organization: profile?.organization || farm?.name || '',
      jobRole: profile?.job_role ?? null,
      phone: profile?.phone ?? '',
    },
  };
}
