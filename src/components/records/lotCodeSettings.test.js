import { describe, it, expect } from 'vitest';
import { lotCodeSettingsFor } from './lotCodeSettings.js';
import { DEFAULT_LOT_FORMAT } from '../../domain/records/lotCodes.js';

describe('lotCodeSettingsFor', () => {
  const farm = { farm_code: 'GVF', name: 'Green Valley Farm' };

  it('uses the format from the farm profile, with the farm’s code and name', () => {
    expect(lotCodeSettingsFor({ lotCodeFormat: ' {FARM}-{YYYYMMDD}-{SEQ} ', farm })).toEqual({ format: '{FARM}-{YYYYMMDD}-{SEQ}', farmCode: 'GVF', farmName: 'Green Valley Farm' });
  });

  it('uses the usual format when the profile has none, or one that cannot be used', () => {
    for (const lotCodeFormat of [undefined, '', '   ', '{FARM}-{CROP}', '{COLOR}{YYYYMMDD}', 5]) {
      expect(lotCodeSettingsFor({ lotCodeFormat, farm }).format, String(lotCodeFormat)).toBe(DEFAULT_LOT_FORMAT);
    }
  });

  it('copes with a farm that is not there yet', () => {
    expect(lotCodeSettingsFor({ lotCodeFormat: undefined, farm: null })).toEqual({ format: DEFAULT_LOT_FORMAT, farmCode: '', farmName: '' });
  });
});
