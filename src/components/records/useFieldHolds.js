import { useMemo } from 'react';
import { computeFieldHolds, HOLD_KINDS } from '../../domain/records/holds.js';
import useFarmRecords from './useFarmRecords.js';

/**
 * The farm's fields that are on hold, worked out from its approved weather events, wildlife checks and
 * corrective actions. Pass no `farmId` to skip reading (a form that has no field to check).
 * `status` is 'loading' until the records are read and 'error' when they could not be: a screen must not
 * treat "could not check" as "nothing is on hold".
 *
 * @param {{ farmId?: string }} options
 */
export default function useFieldHolds({ farmId }) {
  const { status, records, truncated, reload } = useFarmRecords({ farmId, kinds: HOLD_KINDS });
  const holds = useMemo(() => computeFieldHolds(records), [records]);
  return { status, holds, truncated, reload };
}
