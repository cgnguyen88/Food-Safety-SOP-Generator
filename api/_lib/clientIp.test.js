import { describe, it, expect } from 'vitest';
import { clientIp } from './clientIp.js';

const req = (headers = {}, remoteAddress) => ({ headers, socket: remoteAddress ? { remoteAddress } : undefined });

describe('clientIp', () => {
  it('uses the platform’s own header first, then the others', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '203.0.113.1', 'x-real-ip': '203.0.113.2', 'x-forwarded-for': '203.0.113.3' }))).toBe('203.0.113.1');
    expect(clientIp(req({ 'x-real-ip': '203.0.113.2', 'x-forwarded-for': '203.0.113.3' }))).toBe('203.0.113.2');
    expect(clientIp(req({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }))).toBe('198.51.100.4');
    expect(clientIp(req({}, '192.0.2.9'))).toBe('192.0.2.9');
  });

  it('skips a header that is not an address, and uses the next', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': 'not an ip', 'x-real-ip': '203.0.113.2' }))).toBe('203.0.113.2');
  });

  it('never returns text a caller made up, or one that is too long to be an address', () => {
    expect(clientIp(req({ 'x-forwarded-for': 'x'.repeat(500) }))).toBe('unknown');
    expect(clientIp(req({ 'x-real-ip': "1.2.3.4'; drop table" }))).toBe('unknown');
    expect(clientIp(req({ 'x-real-ip': `${'1'.repeat(80)}` }))).toBe('unknown');
  });

  it('gives everyone with no usable address one shared bucket', () => {
    expect(clientIp(req())).toBe('unknown');
    expect(clientIp({})).toBe('unknown');
    expect(clientIp(req({ 'x-real-ip': '' }))).toBe('unknown');
  });

  it('counts an IPv6 address by its network, so rotating the last part changes nothing', () => {
    const a = clientIp(req({ 'x-real-ip': '2001:db8:abcd:12::1' }));
    const b = clientIp(req({ 'x-real-ip': '2001:db8:abcd:12:ffff:ffff:ffff:ffff' }));
    const c = clientIp(req({ 'x-real-ip': '2001:db8:abcd:13::1' }));
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('writes an IPv6 address the same way however it is spelled', () => {
    expect(clientIp(req({ 'x-real-ip': '2001:0DB8:0000:0000:0000:0000:0000:0001' }))).toBe('2001:db8:0:0::/64');
    expect(clientIp(req({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8:0:0::/64');
  });

  it('treats an IPv4 address carried in an IPv6 one as the IPv4 address', () => {
    expect(clientIp(req({ 'x-real-ip': '::ffff:203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('is short enough for the rate limit table', () => {
    expect(clientIp(req({ 'x-real-ip': '2001:db8:abcd:12:ffff:ffff:ffff:ffff' })).length).toBeLessThanOrEqual(64);
  });
});
