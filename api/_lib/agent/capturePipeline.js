import { redact } from '../httpUtils.js';
import { buildCaptureRows, CAPTURE_SOURCE, captureHashOf } from './captureRows.js';
import { readFieldNames, readWaterSourceNames } from './fieldNames.js';
import { RESTRICTED_KINDS } from '../../../src/domain/records/kinds.js';
import { canSeeKind } from '../../../src/domain/records/workflow.js';
import { checkedByLabelOnly } from '../../../src/domain/records/sanitation.js';

const UNIQUE_VIOLATION = '23505';
/** A rejected or voided capture no longer counts as "already filed". */
const TERMINAL_STATUSES = ['rejected', 'voided'];
const MAX_REFILE_ATTEMPTS = 3;

/** A failure in one stage of the pipeline, so each caller can answer in its own way. */
export class PipelineError extends Error {
  /** @param {'lookup' | 'extract' | 'save'} stage @param {unknown} cause */
  constructor(stage, cause) {
    super(`capture pipeline failed at ${stage}`);
    this.name = 'PipelineError';
    this.stage = stage;
    this.cause = cause;
  }
}

/**
 * A cleaning log's pass or fail comes from the sanitizer's approved label, never from the model. When the labels cannot
 * be read the logs are filed without a result, to be decided by the person who reviews them.
 */
async function checkSanitation(proposals, ports, logger) {
  const logs = proposals.filter((proposal) => proposal.kind === 'sanitation_log');
  if (logs.length === 0) return proposals;
  let labels = null;
  if (ports.listSanitizerLabels) {
    try {
      labels = await ports.listSanitizerLabels();
    } catch (err) {
      logger.warn('[capture] could not read the sanitizer labels; filing cleaning logs without a result', { reason: redact(err?.message ?? err) });
    }
  }
  // Whatever result the model wrote is dropped: only an approved label may set one.
  return proposals.map((proposal) => (proposal.kind === 'sanitation_log' ? { ...proposal, payload: checkedByLabelOnly(proposal.payload, labels, proposal.record_date ?? undefined) } : proposal));
}

/**
 * Read a message and/or files and file the records for review. Shared by every way in (the web
 * form, Telegram, ...): the caller has already authenticated the person and chosen their farm, and
 * supplies the database access as `ports` bound to that farm.
 *
 * @param {{
 *   ports: {
 *     findCapture: (captureHash: string) => Promise<object[]>,
 *     uploadAttachments: (q: { captureHash: string, attachments: object[] }) => Promise<object[]>,
 *     insertRecords: (rows: object[]) => Promise<object[]>,
 *     listFieldNames?: () => Promise<string[]>,
 *     listWaterSourceNames?: () => Promise<string[]>,
 *     listSanitizerLabels?: () => Promise<object[]>,
 *   },
 *   extract: Function, anthropic: object, config: object,
 *   userId: string, farmId: string, role: string,
 *   text: string, attachments: object[], lang: 'en' | 'es', day: string,
 *   source?: string, logger: { error: Function, info: Function }, signal?: AbortSignal,
 * }} args
 * @returns {Promise<
 *   { outcome: 'duplicate', rows: object[] }
 *   | { outcome: 'empty', message: string, refused: boolean, flags: object }
 *   | { outcome: 'saved', rows: object[], message: string, flags: object, warnings: string[], usage: object }
 * >}
 * @throws {PipelineError}
 */
export async function runCapture({ ports, extract, anthropic, config, userId, farmId, role, text, attachments, day, source = CAPTURE_SOURCE, logger, signal }) {
  // ── Already captured? Answer without spending a model call ────────────────
  let captureHash;
  try {
    for (let attempt = 0; ; attempt += 1) {
      captureHash = captureHashOf({ text, attachments, userId, day, attempt });
      const existing = await ports.findCapture(captureHash);
      if (existing.length === 0) break;
      const stillLive = existing.some((row) => !TERMINAL_STATUSES.includes(row.status));
      if (stillLive || attempt >= MAX_REFILE_ATTEMPTS) return { outcome: 'duplicate', rows: existing };
    }
  } catch (err) {
    throw new PipelineError('lookup', err);
  }

  // ── Read ──────────────────────────────────────────────────────────────────
  // The farm's field names help the model spell a field the way the farm does; the capture goes on without them.
  const fieldNames = await readFieldNames(ports.listFieldNames, logger);
  const waterSourceNames = await readWaterSourceNames(ports.listWaterSourceNames, logger);
  let result;
  try {
    result = await extract({ anthropic, config, input: { text, attachments }, today: day, signal, fieldNames, waterSourceNames });
  } catch (err) {
    throw new PipelineError('extract', err);
  }

  // Health information stays with owners and managers, whatever way it comes in: the chat has no row-level security
  // to hide it, so the rule is applied here.
  const allowed = result.proposals.filter((proposal) => canSeeKind(proposal.kind, role));
  const restrictedSkipped = result.proposals.length - allowed.length;
  const flags = { truncated: result.truncated, tooMany: result.tooMany, skipped: result.skippedProposals, restrictedSkipped };
  if (result.refused || allowed.length === 0) {
    return { outcome: 'empty', message: restrictedSkipped > 0 ? '' : result.message, refused: result.refused, flags };
  }
  const proposals = await checkSanitation(allowed, ports, logger);

  // ── File for review ───────────────────────────────────────────────────────
  // Keep the source photo so a reviewer can check the record against it. Losing it is worse than
  // not having asked, but not worth losing the (paid-for) extraction: save the records and warn.
  const warnings = [];
  let storedFiles = [];
  if (attachments.length > 0) {
    try {
      // A photo that goes with a restricted record, or with one that was held back from this sender, is kept where only
      // owners and managers can open it: other records from the same photo would otherwise show it to everyone.
      const restricted = restrictedSkipped > 0 || proposals.some((proposal) => RESTRICTED_KINDS.includes(proposal.kind));
      storedFiles = await ports.uploadAttachments({ captureHash, attachments, restricted });
    } catch (err) {
      logger.error('[capture] storing the source files failed', { userId, farmId, reason: redact(err?.message ?? err) });
      warnings.push('files_not_saved');
    }
  }
  const rows = buildCaptureRows({ proposals, farmId, userId, captureHash, attachments: storedFiles, source });

  let saved;
  try {
    saved = await ports.insertRecords(rows);
  } catch (err) {
    if (err?.code === UNIQUE_VIOLATION) {
      // A concurrent request filed the same capture first.
      const existing = await ports.findCapture(captureHash).catch(() => []);
      if (existing.length > 0) return { outcome: 'duplicate', rows: existing };
    }
    throw new PipelineError('save', err);
  }

  logger.info('[capture] captured', { userId, farmId, source, records: saved.length, usage: result.usage });
  return { outcome: 'saved', rows: saved, message: result.message, flags, warnings, usage: result.usage };
}
