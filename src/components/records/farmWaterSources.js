import { createContext, useContext } from 'react';
import { listWaterSources } from '../../lib/waterSources.js';
import useLoadFarmList from './useLoadFarmList.js';

const NO_SOURCES = Object.freeze([]);
const NOTHING_TO_READ = Object.freeze({ status: 'ready', sources: NO_SOURCES, errorCode: null });

/** What a form sees outside a provider: an empty list that is ready, so it works without one. */
export const FarmWaterSourcesContext = createContext({ ...NOTHING_TO_READ, reload: () => {} });

/** The signed-in farm's list of water sources: `{ status: 'loading' | 'ready' | 'error', sources, reload }`. */
export const useFarmWaterSources = () => useContext(FarmWaterSourcesContext);

/**
 * Reads a farm's water sources (those in use first, then by name): see `useLoadFarmList` for when it reads and what it shows meanwhile.
 *
 * @param {string | undefined} farmId
 * @returns {{ status: 'loading' | 'ready' | 'error', sources: object[], errorCode: string | null, reload: () => void }} `errorCode` says why a read failed (see `describeWaterSourceError`)
 */
export function useLoadWaterSources(farmId) {
  const { items, ...rest } = useLoadFarmList(farmId, listWaterSources, 'water sources');
  return { ...rest, sources: items };
}
