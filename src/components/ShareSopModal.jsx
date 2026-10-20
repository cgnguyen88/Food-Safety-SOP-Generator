import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { buildPosterHtml } from '../lib/posterHtml.js';
import { qrSvg } from '../lib/qr.js';
import { createShare, getShare, shareUrl, turnOffShare } from '../lib/sopShares.js';
import { sharedText } from './sharedText.js';
import Modal from './records/Modal.jsx';
import * as ui from './records/ui.js';

const small = { ...ui.buttonSecondary, padding: '6px 12px', fontSize: 13 };

/**
 * The window for sharing one SOP: make a link (with a QR code), copy it, print a poster for the wall, or turn it off.
 * Only owners and managers see the button that opens it, and the database lets only them make or turn off links.
 */
export default function ShareSopModal({ farmId, sopId, sopTitle, farmName, filledIn, onClose }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = sharedText(lang).modal;

  const [state, setState] = useState({ status: 'loading', share: null });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // null, or { kind: 'copied' | 'copyFailed' | 'popupBlocked' | 'turnedOff' | 'error' }

  useEffect(() => {
    let alive = true;
    getShare(farmId, sopId).then(({ data, error }) => {
      if (alive) setState(error ? { status: 'error', share: null } : { status: 'ready', share: data });
    });
    return () => { alive = false; };
  }, [farmId, sopId]);

  const url = state.share ? shareUrl(window.location.origin, state.share.token) : '';

  async function create() {
    setBusy(true);
    setNote(null);
    const { data, error } = await createShare(farmId, sopId);
    setBusy(false);
    if (error) setNote({ kind: 'error' });
    else setState({ status: 'ready', share: data });
  }

  async function turnOff() {
    if (!window.confirm(tt.turnOffConfirm)) return;
    setBusy(true);
    setNote(null);
    const { error } = await turnOffShare(state.share.id);
    setBusy(false);
    if (error) setNote({ kind: 'error' });
    else {
      setState({ status: 'ready', share: null });
      setNote({ kind: 'turnedOff' });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNote({ kind: 'copied' });
    } catch {
      setNote({ kind: 'copyFailed' });
    }
  }

  function printPoster() {
    const popup = window.open('', '_blank');
    if (!popup) {
      setNote({ kind: 'popupBlocked' });
      return;
    }
    popup.document.open();
    popup.document.write(buildPosterHtml({ lang, farmName, sopTitle, svg: qrSvg(url), headline: tt.poster.headline, hint: tt.poster.hint }));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  const noteText = note && (note.kind === 'error' ? tt.error : tt[note.kind]);
  const noteColor = note?.kind === 'copied' || note?.kind === 'turnedOff' ? '#166534' : '#b91c1c';

  return (
    <Modal title={tt.title} onClose={onClose} dismissible={!busy}>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px' }}>{tt.intro}</p>
      <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', margin: '0 0 16px' }}>{tt.warning}</p>

      {state.status === 'loading' && <p style={{ color: '#94a3b8' }}>{tt.loading}</p>}
      {state.status === 'error' && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{tt.error}</p>}

      {state.status === 'ready' && !state.share && (
        <>
          {!filledIn && <p style={{ fontSize: 13, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px' }}>{tt.noSop}</p>}
          <button type="button" disabled={busy} onClick={create} style={{ ...ui.buttonPrimary, ...(busy ? ui.buttonDisabled : {}) }}>{busy ? tt.creating : tt.create}</button>
        </>
      )}

      {state.status === 'ready' && state.share && (
        <>
          {/* The picture is made by this app from the link alone: nothing a person typed goes into it. */}
          <div style={{ width: 220, maxWidth: '100%', margin: '0 auto 16px' }} role="img" aria-label={`QR: ${sopTitle}`} dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
          <label htmlFor="share-link" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{tt.linkLabel}</label>
          <input id="share-link" readOnly value={url} onFocus={(event) => event.target.select()} style={{ ...ui.input, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={copy} style={small}>{tt.copy}</button>
            <button type="button" onClick={printPoster} style={small}>{tt.print}</button>
            <button type="button" disabled={busy} onClick={turnOff} style={{ ...ui.buttonDanger, padding: '6px 12px', fontSize: 13, ...(busy ? ui.buttonDisabled : {}) }}>{tt.turnOff}</button>
          </div>
        </>
      )}

      {noteText && <p role="status" style={{ fontSize: 13, color: noteColor, margin: '14px 0 0' }}>{note.kind === 'copied' ? tt.copied : noteText}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button type="button" onClick={onClose} disabled={busy} style={ui.buttonSecondary}>{tt.close}</button>
      </div>
    </Modal>
  );
}
