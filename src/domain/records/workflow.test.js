import { describe, it, expect } from 'vitest';
import { allowedTransitions, availableActions, canEditRecord, canReview, canSeeKind, detailActions, finishSteps, STATUS_TONE } from './workflow.js';
import { RECORD_STATUSES } from './kinds.js';

describe('canReview', () => {
  it.each([['owner', true], ['manager', true], ['crew', false], [null, false], [undefined, false], ['superuser', false]])('%s → %s', (role, expected) => {
    expect(canReview(role)).toBe(expected);
  });
});

describe('allowedTransitions', () => {
  it('lets owners and managers move records along the review workflow', () => {
    for (const role of ['owner', 'manager']) {
      expect(allowedTransitions('pending_review', role).sort()).toEqual(['approved', 'needs_info', 'rejected', 'voided']);
      expect(allowedTransitions('approved', role)).toEqual(['voided']);
      expect(allowedTransitions('rejected', role).sort()).toEqual(['pending_review', 'voided']);
      expect(allowedTransitions('draft', role).sort()).toEqual(['needs_info', 'pending_review', 'voided']);
      expect(allowedTransitions('needs_info', role).sort()).toEqual(['draft', 'pending_review', 'voided']);
    }
  });

  it('treats voided as final', () => {
    expect(allowedTransitions('voided', 'owner')).toEqual([]);
  });

  it('lets crew only move their own records toward review, never approve, reject or void', () => {
    expect(allowedTransitions('draft', 'crew').sort()).toEqual(['needs_info', 'pending_review']);
    expect(allowedTransitions('needs_info', 'crew').sort()).toEqual(['draft', 'pending_review']);
    expect(allowedTransitions('pending_review', 'crew')).toEqual(['needs_info']);
    expect(allowedTransitions('approved', 'crew')).toEqual([]);
    expect(allowedTransitions('rejected', 'crew')).toEqual([]);
  });

  it('allows nothing without a role', () => {
    for (const status of RECORD_STATUSES) expect(allowedTransitions(status, null)).toEqual([]);
  });
});

describe('canEditRecord', () => {
  const rec = (status, created_by = 'u1') => ({ status, created_by });

  it('lets owners and managers edit any record that is not voided', () => {
    expect(canEditRecord(rec('approved'), 'manager', 'someone')).toBe(true);
    expect(canEditRecord(rec('voided'), 'owner', 'someone')).toBe(false);
  });

  it('lets crew edit only their own unreviewed records', () => {
    expect(canEditRecord(rec('pending_review'), 'crew', 'u1')).toBe(true);
    expect(canEditRecord(rec('draft'), 'crew', 'u1')).toBe(true);
    expect(canEditRecord(rec('pending_review'), 'crew', 'u2')).toBe(false);
    expect(canEditRecord(rec('approved'), 'crew', 'u1')).toBe(false);
    expect(canEditRecord(rec('rejected'), 'crew', 'u1')).toBe(false);
  });

  it('allows nothing without a role or user', () => {
    expect(canEditRecord(rec('draft'), null, 'u1')).toBe(false);
    expect(canEditRecord(rec('draft'), 'crew', null)).toBe(false);
  });
});

describe('STATUS_TONE', () => {
  it('has a tone for every status', () => {
    for (const status of RECORD_STATUSES) expect(['neutral', 'warning', 'success', 'danger', 'muted']).toContain(STATUS_TONE[status]);
  });
});

describe('availableActions (what the UI offers this person on this record)', () => {
  const rec = (status, created_by = 'u1') => ({ status, created_by });

  it('offers owners and managers every allowed transition', () => {
    expect(availableActions(rec('pending_review'), 'owner', 'someone').sort()).toEqual(['approved', 'needs_info', 'rejected', 'voided']);
    expect(availableActions(rec('approved'), 'manager', 'someone')).toEqual(['voided']);
  });

  it('lets crew send THEIR OWN draft or needs-info record for review, and nothing else', () => {
    expect(availableActions(rec('draft'), 'crew', 'u1')).toEqual(['pending_review']);
    expect(availableActions(rec('needs_info'), 'crew', 'u1')).toEqual(['pending_review']);
    expect(availableActions(rec('pending_review'), 'crew', 'u1')).toEqual([]);
    expect(availableActions(rec('approved'), 'crew', 'u1')).toEqual([]);
  });

  it('offers crew nothing on someone else’s record, and nobody anything without a role or user', () => {
    expect(availableActions(rec('draft'), 'crew', 'u2')).toEqual([]);
    expect(availableActions(rec('draft'), 'crew', null)).toEqual([]);
    expect(availableActions(rec('draft'), null, 'u1')).toEqual([]);
  });

  it('never offers an action the database would refuse', () => {
    for (const status of ['draft', 'needs_info', 'pending_review', 'approved', 'rejected', 'voided']) {
      for (const role of ['owner', 'manager', 'crew']) {
        for (const to of availableActions(rec(status), role, 'u1')) expect(allowedTransitions(status, role), `${role} ${status}->${to}`).toContain(to);
      }
    }
  });
});

describe('canSeeKind', () => {
  it('shows illness and injury reports to owners and managers only, and every other kind to everyone', () => {
    expect(canSeeKind('illness_injury', 'owner')).toBe(true);
    expect(canSeeKind('illness_injury', 'manager')).toBe(true);
    expect(canSeeKind('illness_injury', 'crew')).toBe(false);
    expect(canSeeKind('illness_injury', null)).toBe(false);
    expect(canSeeKind('harvest', 'crew')).toBe(true);
    expect(canSeeKind('training', undefined)).toBe(true);
  });
});

describe('finishSteps (how far one click can take a record, and the steps the database takes to get there)', () => {
  const rec = (status, created_by = 'u1') => ({ status, created_by });

  it('takes an owner or manager from a draft or a needs-info record straight to approved, through review', () => {
    for (const role of ['owner', 'manager']) {
      expect(finishSteps(rec('draft'), role, 'someone')).toEqual(['pending_review', 'approved']);
      expect(finishSteps(rec('needs_info'), role, 'someone')).toEqual(['pending_review', 'approved']);
      expect(finishSteps(rec('pending_review'), role, 'someone')).toEqual(['approved']);
    }
  });

  it('has nothing to finish on a record that is approved, rejected or voided', () => {
    for (const status of ['approved', 'rejected', 'voided']) expect(finishSteps(rec(status), 'owner', 'someone')).toEqual([]);
  });

  it('takes crew only as far as review, and only on their own draft or needs-info record', () => {
    expect(finishSteps(rec('draft'), 'crew', 'u1')).toEqual(['pending_review']);
    expect(finishSteps(rec('needs_info'), 'crew', 'u1')).toEqual(['pending_review']);
    expect(finishSteps(rec('draft'), 'crew', 'u2')).toEqual([]);
    expect(finishSteps(rec('pending_review'), 'crew', 'u1')).toEqual([]);
    expect(finishSteps(rec('draft'), 'crew', null)).toEqual([]);
  });

  it('has nothing for someone with no role', () => {
    expect(finishSteps(rec('draft'), null, 'u1')).toEqual([]);
    expect(finishSteps(rec('draft'), 'visitor', 'u1')).toEqual([]);
  });

  it('only ever takes steps the database allows, one at a time', () => {
    for (const role of ['owner', 'manager', 'crew']) {
      for (const status of RECORD_STATUSES) {
        let from = status;
        for (const step of finishSteps(rec(status), role, 'u1')) {
          expect(allowedTransitions(from, role), `${role}: ${from} → ${step}`).toContain(step);
          from = step;
        }
      }
    }
  });
});

describe('detailActions (the buttons a record’s detail shows)', () => {
  const rec = (status, created_by = 'u1') => ({ status, created_by });

  it('gives an owner or manager Approve and Delete on a draft or needs-info record, not the in-between steps', () => {
    for (const status of ['draft', 'needs_info']) {
      expect(detailActions(rec(status), 'owner', 'someone')).toEqual(['approved', 'voided']);
      expect(detailActions(rec(status), 'manager', 'someone')).toEqual(['approved', 'voided']);
    }
  });

  it('leaves a record that is waiting for review with all the reviewer’s choices', () => {
    expect(detailActions(rec('pending_review'), 'owner', 'someone').sort()).toEqual(['approved', 'needs_info', 'rejected', 'voided']);
  });

  it('leaves approved and rejected records as they were', () => {
    expect(detailActions(rec('approved'), 'owner', 'someone')).toEqual(['voided']);
    expect(detailActions(rec('rejected'), 'owner', 'someone').sort()).toEqual(['pending_review', 'voided']);
    expect(detailActions(rec('voided'), 'owner', 'someone')).toEqual([]);
  });

  it('gives crew what they had: sending their own record for review', () => {
    expect(detailActions(rec('draft'), 'crew', 'u1')).toEqual(['pending_review']);
    expect(detailActions(rec('draft'), 'crew', 'u2')).toEqual([]);
    expect(detailActions(rec('approved'), 'crew', 'u1')).toEqual([]);
  });
});
