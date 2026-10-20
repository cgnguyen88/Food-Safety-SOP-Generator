import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSignedUrl = vi.fn();
const from = vi.fn(() => ({ createSignedUrl }));
vi.mock('./supabase.js', () => ({ supabase: { storage: { from } } }));
const { getAttachmentUrl } = await import('./attachments.js');

beforeEach(() => {
  createSignedUrl.mockReset();
  from.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getAttachmentUrl', () => {
  it('asks for a five-minute link from the private record-files bucket, whatever bucket the file names', async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/signed' }, error: null });
    expect(await getAttachmentUrl({ path: 'farm-1/a.jpg', bucket: 'public-bucket' })).toBe('https://x/signed');
    expect(from).toHaveBeenCalledWith('record-files');
    expect(createSignedUrl).toHaveBeenCalledWith('farm-1/a.jpg', 300);
  });

  it('gives null for a missing path or a file that cannot be opened', async () => {
    expect(await getAttachmentUrl(null)).toBeNull();
    expect(await getAttachmentUrl({ path: '' })).toBeNull();
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } });
    expect(await getAttachmentUrl({ path: 'x' })).toBeNull();
  });
});
