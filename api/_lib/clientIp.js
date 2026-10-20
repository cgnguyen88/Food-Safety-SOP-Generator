import { isIP } from 'node:net';

const UNKNOWN = 'unknown';

/** An IPv6 address reduced to its /64 (the part one network is given), so one person cannot rotate through endless addresses. */
function networkOf(address) {
  if (isIP(address) !== 6) return address;
  const [head, tail = ''] = address.toLowerCase().split('::');
  const groups = head.split(':').filter(Boolean);
  const rest = tail.split(':').filter(Boolean);
  const whole = tail === '' && !address.includes('::') ? groups : [...groups, ...Array(Math.max(0, 8 - groups.length - rest.length)).fill('0'), ...rest];
  return `${whole.slice(0, 4).map((part) => part.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/**
 * The address of whoever is asking, for rate limits only. The platform's own header is used first, then the others, and
 * only a real IP address is accepted (never text a caller made up, which could be any length). IPv6 counts by network.
 * When there is no usable address everyone shares one strict bucket, rather than getting an unlimited one.
 *
 * @param {{ headers?: Record<string, unknown>, socket?: { remoteAddress?: string } }} req
 * @returns {string}
 */
export function clientIp(req) {
  const first = (value) => String(value ?? '').split(',')[0].trim();
  const candidates = [req.headers?.['x-vercel-forwarded-for'], req.headers?.['x-real-ip'], req.headers?.['x-forwarded-for'], req.socket?.remoteAddress];
  for (const candidate of candidates) {
    const address = first(candidate).replace(/^::ffff:/i, '');
    if (address.length <= 45 && isIP(address) !== 0) return networkOf(address);
  }
  return UNKNOWN;
}
