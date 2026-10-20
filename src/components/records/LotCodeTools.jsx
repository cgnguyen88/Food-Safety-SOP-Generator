import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { fillLotCode } from '../../domain/records/lotCodes.js';
import { recordsText } from './text.js';
import { useLotCodeSettings } from './lotCodeSettings.js';
import useFarmRecords from './useFarmRecords.js';
import * as ui from './ui.js';

const HARVESTS = ['harvest'];
const NOTE = { fontSize: 12, margin: '6px 0 0' };

/**
 * The "Make lot code" button under a harvest's lot code box. The code is made from the harvest itself (farm, crop,
 * date, field) in the farm's format, and a code already used gets a number added. It is held back, with the reason
 * on screen, when the harvest's field is on hold, when that cannot be checked, or when the codes already used cannot
 * be read: a guess could repeat a code or give one to produce that should not leave the farm.
 *
 * @param {{ farmId: string, recordId?: string, values: Record<string, string>, date: string, holds: { status: string }, heldField: { name: string } | null, onMade: (code: string) => void }} props
 */
export default function LotCodeTools({ farmId, recordId, values, date, holds, heldField, onMade }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang);
  const settings = useLotCodeSettings();
  const used = useFarmRecords({ farmId, kinds: HARVESTS, includeUnapproved: true });
  const [problem, setProblem] = useState(null);
  const [madeCode, setMadeCode] = useState(null);

  const reason = heldField ? tt.lots.held(heldField.name)
    : holds.status === 'loading' ? tt.lots.checkingHolds
    : holds.status === 'error' ? tt.holds.unknown
    : used.status === 'loading' ? tt.lots.checkingCodes
    : used.status === 'error' ? tt.lots.codesError
    : used.truncated ? tt.lots.codesTruncated
    : null;
  const empty = values.lot_code === undefined || String(values.lot_code).trim() === '';

  function make() {
    const existingCodes = used.records.filter((record) => record.id !== recordId).map((record) => record.payload?.lot_code);
    const result = fillLotCode(values, date, { ...settings, existingCodes });
    if (result.ok) {
      setProblem(null);
      setMadeCode(result.code);
      onMade(result.code);
    } else {
      setMadeCode(null);
      setProblem(result.reason === 'missing' ? tt.lots.missing([...new Set(result.missing.map((name) => tt.lots.parts[name] ?? name))].join(', ')) : tt.lots.badFormat);
    }
  }

  return (
    <div style={{ margin: '-6px 0 14px' }}>
      <button type="button" disabled={reason !== null} onClick={make} style={{ ...ui.buttonSecondary, padding: '4px 12px', fontSize: 12, ...(reason ? ui.buttonDisabled : {}) }}>
        {empty ? tt.lots.make : tt.lots.makeAgain}
      </button>
      {reason && <p role="status" style={{ ...NOTE, color: heldField || holds.status === 'error' || used.status === 'error' || used.truncated ? '#991b1b' : '#64748b' }}>{reason}</p>}
      {!reason && problem && <p role="status" style={{ ...NOTE, color: '#92400e' }}>{problem}</p>}
      {!reason && !problem && madeCode && <p role="status" style={{ ...NOTE, color: '#166534' }}>{tt.lots.made(madeCode)}</p>}
    </div>
  );
}
