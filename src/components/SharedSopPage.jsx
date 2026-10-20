import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getLocalizedSop } from '../i18n/sop-translations.js';
import { SOP_DATA } from '../data/sop-data.js';
import { loadSharedSop, signSharedSop } from '../lib/publicSop.js';
import { sharedText } from './sharedText.js';
import * as ui from './records/ui.js';

const FAILURE = { invalid: 'invalid', busy: 'busy' };

function Values({ sop, values }) {
  const sections = sop.sections
    .map((section) => ({ ...section, fields: section.fields.filter((field) => values[field.id] !== undefined) }))
    .filter((section) => section.fields.length > 0);
  return sections.map((section) => (
    <section key={section.id} style={{ ...ui.card, padding: '16px 18px', marginBottom: 14 }}>
      <h2 style={{ fontSize: 16, color: 'var(--u-navy)', margin: '0 0 10px', fontFamily: 'Lora, serif' }}>{section.title}</h2>
      {section.fields.map((field) => (
        <div key={field.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>{field.label}</div>
          {Array.isArray(values[field.id])
            ? <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>{values[field.id].map((item) => <li key={item}>{item}</li>)}</ul>
            : <div style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{values[field.id]}</div>}
        </div>
      ))}
    </section>
  ));
}

function SignOff({ token, tt, lang }) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState({ status: 'idle', signed: '' }); // idle | sending | done | failed
  const [problem, setProblem] = useState(null); // null | 'nameProblem' | 'agreeProblem'

  async function submit(event) {
    event.preventDefault();
    const typed = name.replace(/\s+/g, ' ').trim();
    if (typed.length < 2) return setProblem('nameProblem');
    if (!agree) return setProblem('agreeProblem');
    setProblem(null);
    setState({ status: 'sending', signed: '' });
    const { error } = await signSharedSop({ token, name: typed, agree: true, lang });
    setState(error ? { status: 'failed', signed: '' } : { status: 'done', signed: typed });
  }

  if (state.status === 'done') {
    return (
      <div role="status" style={{ ...ui.card, padding: 18, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{tt.sign.thanks(state.signed)}</p>
        <button type="button" onClick={() => { setName(''); setAgree(false); setState({ status: 'idle', signed: '' }); }} style={ui.buttonSecondary}>{tt.sign.another}</button>
      </div>
    );
  }

  const sending = state.status === 'sending';
  return (
    <form onSubmit={submit} noValidate style={{ ...ui.card, padding: 18 }}>
      <h2 style={{ fontSize: 16, color: 'var(--u-navy)', margin: '0 0 12px', fontFamily: 'Lora, serif' }}>{tt.sign.title}</h2>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, marginBottom: 14 }}>
        <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
        {tt.sign.agree}
      </label>
      <label htmlFor="signer-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{tt.sign.name}</label>
      <input id="signer-name" value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} style={{ ...ui.input, marginBottom: 12 }} />
      {problem && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 12px' }}>{tt.sign[problem]}</p>}
      {state.status === 'failed' && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, margin: '0 0 12px' }}>{tt.sign.failed}</p>}
      <button type="submit" disabled={sending} style={{ ...ui.buttonPrimary, ...(sending ? ui.buttonDisabled : {}) }}>{sending ? tt.sign.sending : tt.sign.button}</button>
    </form>
  );
}

/**
 * What a worker sees after scanning a SOP's QR code: the SOP as the farm filled it in, in English or Spanish, and a
 * box to sign that they read it. No one is signed in; everything comes from, and goes to, the SOP link.
 */
export default function SharedSopPage({ token }) {
  const { lang: rawLang, toggleLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = sharedText(lang).page;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadSharedSop(token).then(({ data, error }) => {
      if (alive) setLoaded(error ? { status: 'failed', reason: FAILURE[error.code] ?? 'error' } : { status: 'ready', ...data });
    });
    return () => { alive = false; };
  }, [token, attempt]);

  const sop = loaded.status === 'ready' ? SOP_DATA.find((s) => s.id === loaded.sopId) : null;
  const localized = sop ? getLocalizedSop(sop, lang) : null;
  const filled = sop ? Object.keys(loaded.values).length > 0 : false;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ fontFamily: 'Lora, serif', fontWeight: 700, color: 'var(--u-navy)', fontSize: 18 }}>{loaded.farmName || 'FarmSafe'}</span>
        <button type="button" onClick={toggleLang} style={{ ...ui.buttonSecondary, padding: '6px 14px' }}>{tt.language}</button>
      </div>

      {loaded.status === 'loading' && <p role="status" style={{ color: '#64748b' }}>{tt.loading}</p>}

      {loaded.status === 'failed' && (
        <div role="alert" style={{ ...ui.card, padding: 20, color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' }}>
          <p style={{ margin: loaded.reason === 'invalid' ? 0 : '0 0 12px' }}>{loaded.reason === 'invalid' ? tt.invalid : loaded.reason === 'busy' ? tt.busy : tt.error}</p>
          {loaded.reason !== 'invalid' && <button type="button" onClick={() => { setLoaded({ status: 'loading' }); setAttempt((n) => n + 1); }} style={ui.buttonSecondary}>{tt.retry}</button>}
        </div>
      )}

      {localized && (
        <>
          <h1 style={{ ...ui.h1, fontSize: 26 }}>{localized.title}</h1>
          <p style={{ ...ui.subtitle, margin: '0 0 18px' }}>{sop.ref}</p>
          {filled ? <Values sop={localized} values={loaded.values} /> : <p style={{ color: '#64748b' }}>{tt.empty}</p>}
          <SignOff token={token} tt={tt} lang={lang} />
        </>
      )}
    </main>
  );
}
