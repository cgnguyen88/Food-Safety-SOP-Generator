import { supabase } from './supabase.js';

/** The private bucket a record's attached files are kept in (photos from Telegram, uploads). */
const ATTACHMENT_BUCKET = 'record-files';
/** A link to a file works for five minutes: long enough to open it, short enough not to be shared around. */
const ATTACHMENT_URL_TTL_SECONDS = 300;

/**
 * A short-lived link to one of a record's attached files, or null when it cannot be opened. Only the
 * record-files bucket is ever used, whatever an attachment says; storage policies still decide who
 * may open a file.
 *
 * @param {{ path?: string } | null | undefined} file
 * @returns {Promise<string | null>}
 */
export async function getAttachmentUrl(file) {
  const path = file?.path;
  if (typeof path !== 'string' || path === '') return null;
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, ATTACHMENT_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('getAttachmentUrl: the file could not be opened');
    return null;
  }
  return data.signedUrl;
}
