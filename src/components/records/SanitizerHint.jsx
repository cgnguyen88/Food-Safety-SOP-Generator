import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { formatNumber } from './format.js';
import { recordsText } from './text.js';

const NOTE = { fontSize: 12, margin: '-8px 0 14px', padding: '6px 10px', borderRadius: 8 };
const TONE = {
  pass: { background: '#dcfce7', color: '#166534' },
  fail: { background: '#fee2e2', color: '#991b1b' },
  unknown: { background: '#f1f5f9', color: '#475569' },
};

/** The label's range, in words: "100 to 200 ppm", "at least 50 ppm". */
export function describeRange({ min, max }, tt, lang) {
  const range = tt.sanitizerCheck.range;
  const show = (n) => formatNumber(n, lang);
  if (min !== null && max !== null) return range.between(show(min), show(max));
  return min !== null ? range.atLeast(show(min)) : range.upTo(show(max));
}

/**
 * What the sanitizer label says about the concentration just typed (see `checkSanitizerConcentration`). A pass or a
 * fail is final and is also written into the record; with no label to compare against it only explains why.
 *
 * @param {{ check: ReturnType<typeof import('../../domain/records/sanitation.js').checkSanitizerConcentration> | null, loading?: boolean, error?: boolean }} props
 */
export default function SanitizerHint({ check, loading = false, error = false }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang);

  if (error) return <p role="status" style={{ ...NOTE, ...TONE.fail }}>{tt.sanitizerCheck.labelsError}</p>;
  if (loading) return <p role="status" style={{ ...NOTE, ...TONE.unknown }}>{tt.sanitizerCheck.checking}</p>;
  if (!check || check.reason === 'no_reading') return null;

  const range = check.min !== null || check.max !== null ? describeRange(check, tt, lang) : '';
  const message = check.result === 'pass' ? tt.sanitizerCheck.pass(range) : check.result === 'fail' ? tt.sanitizerCheck[check.reason](range) : tt.sanitizerCheck[check.reason];
  const tone = check.result === 'pass' ? TONE.pass : check.result === 'fail' ? TONE.fail : TONE.unknown;
  return <p role="status" style={{ ...NOTE, ...tone }}>{message}</p>;
}
