import { createContext, useContext } from 'react';
import { listFields } from '../../lib/fields.js';
import useLoadFarmList from './useLoadFarmList.js';

const NO_FIELDS = Object.freeze([]);
const NOTHING_TO_READ = Object.freeze({ status: 'ready', fields: NO_FIELDS, errorCode: null });

/** What a form or a record sees outside a provider: an empty list that is ready, so it works without one. */
export const FarmFieldsContext = createContext({ ...NOTHING_TO_READ, reload: () => {} });

/** The signed-in farm's field list: `{ status: 'loading' | 'ready' | 'error', fields, reload }`. */
export const useFarmFields = () => useContext(FarmFieldsContext);

/**
 * Reads a farm's fields (those in use first, then by name): see `useLoadFarmList` for when it reads and what it shows meanwhile.
 *
 * @param {string | undefined} farmId
 * @returns {{ status: 'loading' | 'ready' | 'error', fields: object[], errorCode: string | null, reload: () => void }} `errorCode` says why a read failed (see `describeFieldError`)
 */
export function useLoadFarmFields(farmId) {
  const { items, ...rest } = useLoadFarmList(farmId, listFields, 'farm fields');
  return { ...rest, fields: items };
}
