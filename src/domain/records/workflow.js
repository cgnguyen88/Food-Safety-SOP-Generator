/**
 * Who may do what to a record. This mirrors the rules the database enforces (see
 * supabase/migrations/…_records.sql); a test runs every transition against the real
 * database rules to keep the two in agreement. The UI uses it to show only the actions
 * that will actually succeed.
 */

import { RESTRICTED_KINDS } from './kinds.js';

const REVIEWER_ROLES = ['owner', 'manager'];
const EDITABLE_BY_AUTHOR = ['draft', 'needs_info', 'pending_review'];

/** Transitions owners/managers may make. voided is final. */
const REVIEWER_TRANSITIONS = Object.freeze({
  draft: ['needs_info', 'pending_review', 'voided'],
  needs_info: ['draft', 'pending_review', 'voided'],
  pending_review: ['approved', 'rejected', 'needs_info', 'voided'],
  approved: ['voided'],
  rejected: ['pending_review', 'voided'],
  voided: [],
});

/** Transitions crew may make on their own unreviewed records: toward review, never final decisions. */
const CREW_TRANSITIONS = Object.freeze({
  draft: ['needs_info', 'pending_review'],
  needs_info: ['draft', 'pending_review'],
  pending_review: ['needs_info'],
  approved: [],
  rejected: [],
  voided: [],
});

/** @param {string | null | undefined} role */
export const canReview = (role) => REVIEWER_ROLES.includes(role);

/**
 * Whether this person may see (and so add) records of this kind: illness and injury reports are for
 * owners and managers only. The database enforces the same rule.
 *
 * @param {string} kind
 * @param {string | null | undefined} role
 */
export const canSeeKind = (kind, role) => !RESTRICTED_KINDS.includes(kind) || canReview(role);

/**
 * @param {string} status
 * @param {string | null | undefined} role
 * @returns {string[]}
 */
export function allowedTransitions(status, role) {
  if (canReview(role)) return [...(REVIEWER_TRANSITIONS[status] ?? [])];
  if (role === 'crew') return [...(CREW_TRANSITIONS[status] ?? [])];
  return [];
}

/**
 * The status changes to OFFER this person on this record: everything allowed for owners and
 * managers; for crew only sending their own unreviewed record on to review. (The database
 * enforces the same rules; offering only what will succeed avoids dead-end buttons.)
 *
 * @param {{ status: string, created_by?: string | null }} record
 * @param {string | null | undefined} role
 * @param {string | null | undefined} userId
 * @returns {string[]}
 */
export function availableActions(record, role, userId) {
  if (canReview(role)) return allowedTransitions(record.status, role);
  if (role === 'crew' && userId && record.created_by === userId) {
    return allowedTransitions(record.status, 'crew').filter((status) => status === 'pending_review');
  }
  return [];
}

/** A record nobody has sent for review yet (a draft, or one waiting on details from its author). @param {string} status */
export const isUnfinished = (status) => status === 'draft' || status === 'needs_info';

/** The database moves a record one step at a time, so getting a draft approved goes through review. */
const REVIEWER_FINISH = Object.freeze({
  draft: ['pending_review', 'approved'],
  needs_info: ['pending_review', 'approved'],
  pending_review: ['approved'],
});
const AUTHOR_FINISH = Object.freeze({ draft: ['pending_review'], needs_info: ['pending_review'] });

/**
 * How far one click can take this record, as the steps to take in order: an owner or manager can approve a draft (it
 * goes through review on the way); crew can send their own draft for review. Empty when there is nothing more to do.
 *
 * @param {{ status: string, created_by?: string | null }} record
 * @param {string | null | undefined} role
 * @param {string | null | undefined} userId
 * @returns {string[]}
 */
export function finishSteps(record, role, userId) {
  if (canReview(role)) return [...(REVIEWER_FINISH[record.status] ?? [])];
  if (role === 'crew' && userId && record.created_by === userId) return [...(AUTHOR_FINISH[record.status] ?? [])];
  return [];
}

/**
 * The buttons a record's detail shows. Like availableActions, but an owner or manager looking at a draft (or a record
 * waiting for details) is offered Approve and Delete, not the half-steps in between.
 *
 * @param {{ status: string, created_by?: string | null }} record
 * @param {string | null | undefined} role
 * @param {string | null | undefined} userId
 * @returns {string[]}
 */
export function detailActions(record, role, userId) {
  const offered = availableActions(record, role, userId);
  if (!canReview(role) || !isUnfinished(record.status)) return offered;
  return [...finishSteps(record, role, userId).slice(-1), ...offered.filter((status) => status === 'voided')];
}

/**
 * @param {{ status: string, created_by?: string | null }} record
 * @param {string | null | undefined} role
 * @param {string | null | undefined} userId
 */
export function canEditRecord(record, role, userId) {
  if (!role || !userId) return false;
  if (record.status === 'voided') return false;
  if (canReview(role)) return true;
  return role === 'crew' && record.created_by === userId && EDITABLE_BY_AUTHOR.includes(record.status);
}

/** Visual tone per status (the UI maps tones to colors). */
export const STATUS_TONE = Object.freeze({
  draft: 'neutral',
  needs_info: 'warning',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  voided: 'muted',
});
