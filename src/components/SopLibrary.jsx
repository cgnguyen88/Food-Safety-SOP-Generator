import { ArrowRight, FileCheck2 } from 'lucide-react';
import { SOP_DATA } from '../data/sop-data.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getLocalizedSop } from '../i18n/sop-translations.js';
import { homeText } from './homeText.js';
import PhotoBanner from './PhotoBanner.jsx';
import * as ui from './records/ui.js';

const row = { ...ui.card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', width: '100%', font: 'inherit' };

/** The farm's SOPs and the food safety plan: one list, each a single click from its editor. */
export default function SopLibrary({ onSelectSOP, onOpenPlan }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = homeText(lang).library;
  const sops = SOP_DATA.map((sop) => getLocalizedSop(sop, lang));

  return (
    <div style={ui.page}>
      <PhotoBanner image="/photos/qr-phone.jpg" title={tt.title} subtitle={tt.subtitle} />
      <div style={{ height: 22 }} />

      <button type="button" onClick={onOpenPlan} style={{ ...row, marginBottom: 26, background: '#eff6ff', borderColor: '#bfdbfe' }}>
        <FileCheck2 size={22} color="#1d4ed8" aria-hidden="true" />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, color: '#1e3a8a' }}>{tt.plan}</span>
          <span style={{ fontSize: 13, color: '#1e40af' }}>{tt.planBody}</span>
        </span>
        <ArrowRight size={16} color="#1d4ed8" aria-hidden="true" />
      </button>

      <h2 style={{ fontSize: 14, color: '#475569', margin: '0 0 10px' }}>{tt.sops}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {sops.map((sop, index) => (
          <button key={sop.id} type="button" onClick={() => onSelectSOP(SOP_DATA[index])} style={row}>
            <span aria-hidden="true" style={{ fontSize: 24, flexShrink: 0 }}>{sop.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, color: 'var(--u-navy)' }}>{sop.title}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{sop.desc}</span>
            </span>
            <ArrowRight size={16} color="#94a3b8" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
