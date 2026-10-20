import { sendJson } from './httpUtils.js';
import { cleanSignerName, findSop, parseShareToken, sharedSopView, signOffRow } from './shareSop.js';
import { todayLocalIso } from '../../src/domain/records/seasons.js';

const ALREADY_THERE = '23505';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NOT_VALID = 'This link is not valid any more.';
const DATA_KEYS = ['farm_profile', 'sop_forms'];

/** The caller's address, for rate limits only. The platform sets these headers; nothing is trusted beyond counting. */
const clientIp = (req) =>
  String(req.headers?.['x-real-ip'] ?? '').trim() || String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

function tokenFromRequest(req) {
  if (req.query && typeof req.query.token === 'string') return req.query.token;
  try {
    return new URL(req.url ?? '', 'http://local').searchParams.get('token');
  } catch {
    return null;
  }
}

/**
 * The public endpoint behind a SOP link: GET shows what the link is for, POST records that someone read it.
 * Nobody is signed in, so every request is limited by caller, a token that does not exist looks the same as one that
 * was turned off, and the server (not the link) decides what is shown and what is created.
 *
 * @param {{
 *   getAdmin: () => import('@supabase/supabase-js').SupabaseClient | null,
 *   limiters: { read: { check: Function }, sign: { check: Function }, signPerLink: { check: Function } },
 *   logger?: { error: Function },
 *   now?: () => Date,
 * }} deps
 */
export function createShareHandler({ getAdmin, limiters, logger = console, now = () => new Date() }) {
  const refuse = (res, verdict) => {
    res.setHeader('Retry-After', String(verdict.retryAfterSec));
    sendJson(res, 429, { error: 'Too many requests. Please try again later.' });
  };

  async function findShare(admin, token) {
    const { data, error } = await admin.from('sop_shares').select('id, farm_id, sop_id').eq('token', token).is('revoked_at', null).maybeSingle();
    if (error) throw Object.assign(new Error('share lookup failed'), { code: error.code });
    return data ?? null;
  }

  async function show(admin, share, res) {
    const sop = findSop(share.sop_id);
    if (!sop) return sendJson(res, 404, { error: NOT_VALID });
    const { data, error } = await admin.from('farm_data').select('key, value').eq('farm_id', share.farm_id).in('key', DATA_KEYS);
    if (error) throw Object.assign(new Error('farm data lookup failed'), { code: error.code });
    const byKey = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return sendJson(res, 200, sharedSopView({ sop, form: byKey.sop_forms?.[String(sop.id)], farmProfile: byKey.farm_profile }));
  }

  async function sign(admin, share, body, res) {
    const sop = findSop(share.sop_id);
    const name = cleanSignerName(body?.name);
    if (!sop || !name || body?.agree !== true) return sendJson(res, 400, { error: 'Type your name and confirm that you read it.' });

    const perLink = await limiters.signPerLink.check(share.id);
    if (!perLink.allowed) return refuse(res, perLink);

    const made = signOffRow({ share, sop, name, today: todayLocalIso(now()), lang: body?.lang });
    if (!made.ok) return sendJson(res, 400, { error: 'Type your name and confirm that you read it.' });
    const { error } = await admin.from('records').insert(made.row);
    if (error && error.code !== ALREADY_THERE) throw Object.assign(new Error('sign-off failed'), { code: error.code });
    return sendJson(res, 201, { ok: true, ...(error ? { duplicate: true } : {}) });
  }

  return async function handleShareRequest(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    const ip = clientIp(req);
    const limiter = req.method === 'GET' ? limiters.read : limiters.sign;
    const verdict = await limiter.check(ip);
    if (!verdict.allowed) return refuse(res, verdict);

    const token = parseShareToken(req.method === 'GET' ? tokenFromRequest(req) : req.body?.token);
    if (!token) return sendJson(res, 404, { error: NOT_VALID });

    const admin = getAdmin();
    if (!admin) {
      logger.error('[sop-share] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set on the server');
      return sendJson(res, 503, { error: 'This page is not available right now.' });
    }

    try {
      const share = await findShare(admin, token);
      if (!share) return sendJson(res, 404, { error: NOT_VALID });
      return req.method === 'GET' ? await show(admin, share, res) : await sign(admin, share, req.body, res);
    } catch (err) {
      // The code is enough to investigate; the message could carry connection details.
      logger.error('[sop-share] request failed', { code: err?.code });
      return sendJson(res, 502, { error: GENERIC_ERROR });
    }
  };
}
