import { createClient } from '@supabase/supabase-js';

/** Columns the bot reads back. Provenance (source, source_ref) stays server-side. */
export const RECORD_COLUMNS = 'id, farm_id, kind, status, record_date, payload, missing_fields, confidence, version, created_by, attachments';
const CAPTURE_KEY = /^[0-9a-f]{64}$/;

const FILES_BUCKET = 'record-files';
/** The folder inside a farm's folder for files that only owners and managers may open (illness and injury reports). */
export const RESTRICTED_FOLDER = 'restricted';
const FILE_EXTENSIONS = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUTH_OPTIONS = Object.freeze({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });

function dbError(error) {
  return Object.assign(new Error(error.message ?? 'Database error'), { code: error.code });
}

/**
 * Database access the records bot needs beyond its chat tables. A chat has no signed-in user, so the server
 * role is used, for exactly three things: filing captured records (the columns that say where a record came
 * from and who wrote it are not writable by users), keeping the original photos in the private bucket, and the
 * shared rate limit counts. Every row and path is built by the server from the linked identity, never from a message.
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ createClientImpl?: typeof createClient }} [deps]
 */
export function createAgentStore(env = process.env, { createClientImpl = createClient } = {}) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  let admin = null;
  const asService = () => {
    if (!url || !serviceKey) throw new Error('The records bot needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.');
    admin ??= createClientImpl(url, serviceKey, { auth: AUTH_OPTIONS });
    return admin;
  };

  return {
    /** The only service-role write to records. Rows come from buildCaptureRows(), never from a client. */
    async insertRecords(rows) {
      const { data, error } = await asService().from('records').insert(rows).select(RECORD_COLUMNS);
      if (error) throw dbError(error);
      return data ?? [];
    },

    /**
     * Keep the original photos/PDFs of a capture in the private bucket, under the farm's folder, so a reviewer can
     * compare a record with its source. Files for restricted records (illness and injury) go in a folder that only
     * owners and managers can open. Idempotent (a retry overwrites the same paths). Server-only: the bucket has no
     * client write policy.
     *
     * @returns {Promise<Array<{ path: string, media_type: string, bytes: number }>>}
     */
    async uploadAttachments({ farmId, captureHash, attachments, restricted = false }) {
      // Both ids become path segments: only a uuid and a SHA-256 digest are allowed.
      if (!UUID.test(farmId) || !CAPTURE_KEY.test(captureHash)) throw new Error('Invalid storage path.');
      const files = attachments.map((file, index) => {
        const extension = FILE_EXTENSIONS[file.source.media_type];
        if (!extension) throw new Error(`Unsupported media type: ${file.source.media_type}`);
        return { index, extension, mediaType: file.source.media_type, bytes: Buffer.from(file.source.data, 'base64') };
      });

      const folder = restricted ? `${farmId}/${RESTRICTED_FOLDER}/${captureHash}` : `${farmId}/${captureHash}`;
      const bucket = asService().storage.from(FILES_BUCKET);
      const manifest = [];
      for (const { index, extension, mediaType, bytes } of files) {
        const path = `${folder}/${index}.${extension}`;
        const { error } = await bucket.upload(path, bytes, { contentType: mediaType, upsert: true });
        if (error) throw dbError(error);
        manifest.push({ path, media_type: mediaType, bytes: bytes.length });
      }
      return manifest;
    },

    /** The farm's approved sanitizer labels, so a cleaning log can be checked against its label's range. */
    async listSanitizerLabels({ farmId }) {
      if (!UUID.test(farmId)) throw new Error('Invalid farm.');
      const { data, error } = await asService()
        .from('records')
        .select('id, kind, status, record_date, created_at, payload')
        .eq('farm_id', farmId)
        .eq('kind', 'sanitizer_label')
        .eq('status', 'approved')
        .order('record_date', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw dbError(error);
      return data ?? [];
    },

    /**
     * Take one token from a shared (database-backed) rate limit. Server-only: the caller passes the subject it has
     * already authenticated, and the limits are chosen by the server, never a client.
     *
     * @returns {Promise<{ allowed: boolean, retry_after_sec: number }>}
     */
    async takeRateToken(bucket, subject, max, windowSeconds) {
      const { data, error } = await asService().rpc('take_rate_token', { p_bucket: bucket, p_subject: subject, p_max: max, p_window_seconds: windowSeconds });
      if (error) throw dbError(error);
      if (typeof data?.[0]?.allowed !== 'boolean') throw new Error('The rate limit function returned no verdict.');
      return data[0];
    },
  };
}
