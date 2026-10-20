import { createContext, useContext } from 'react';
import { DEFAULT_LOT_FORMAT, validateLotFormat } from '../../domain/records/lotCodes.js';

/** What a harvest form needs to make lot codes: the farm's format (from its profile), and the name and code the format's {FARM} comes from. */
export const LotCodeSettingsContext = createContext({ format: DEFAULT_LOT_FORMAT, farmCode: '', farmName: '' });

export const useLotCodeSettings = () => useContext(LotCodeSettingsContext);

/**
 * The settings from the farm profile's format and the farm itself. A format that cannot be used (it was typed before the
 * rules, or is blank) falls back to the usual one rather than leaving harvests with no way to get a code.
 *
 * @param {{ lotCodeFormat?: unknown, farm?: { farm_code?: string, name?: string } | null }} input
 */
export function lotCodeSettingsFor({ lotCodeFormat, farm }) {
  const format = typeof lotCodeFormat === 'string' && validateLotFormat(lotCodeFormat).ok ? lotCodeFormat.trim() : DEFAULT_LOT_FORMAT;
  return { format, farmCode: farm?.farm_code ?? '', farmName: farm?.name ?? '' };
}
