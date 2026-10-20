import { useMemo, useState } from 'react';
import { ClipboardCheck, GraduationCap, Plus } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { KIND_META } from '../domain/records/kinds.js';
import { todayLocalIso } from '../domain/records/seasons.js';
import { trainingCounts, trainingDueList } from '../domain/records/training.js';
import { canSeeKind } from '../domain/records/workflow.js';
import { telegramBotUsername } from '../lib/channels.js';
import { ROUTES, logRoute } from '../lib/recordsRoute.js';
import { homeText } from './homeText.js';
import { KIND_ICONS } from './records/icons.js';
import FieldHoldsBanner from './records/FieldHoldsBanner.jsx';
import RecordForm from './records/RecordForm.jsx';
import RecordsProviders from './records/RecordsProviders.jsx';
import TelegramConnect from './records/TelegramConnect.jsx';
import useFarmRecords from './records/useFarmRecords.js';
import useFieldHolds from './records/useFieldHolds.js';
import * as ui from './records/ui.js';

/** The records people add most often, in the order they are shown. */
const QUICK_KINDS = ['harvest', 'sanitation_log', 'wildlife_check', 'shipment', 'visitor', 'training'];
const TRAINING_KINDS = ['training'];

const RESOURCES = [
  { name: 'Cornell PSA Resources', url: 'https://producesafetyalliance.cornell.edu/resources' },
  { name: 'FDA FSMA Produce Safety Rule', url: 'https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-produce-safety' },
  { name: 'UC Davis Post-PSA Grower Training', url: 'https://ucanr.edu/sites/UCSmallFarmProgram/Food_Safety/' },
  { name: 'UMD Sample SOPs & Templates', url: 'https://psla.umd.edu/research/produce-safety/produce-safety-resources' },
];

function AttentionRow({ icon: Icon, text, action, onClick }) {
  return (
    <div style={{ ...ui.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Icon size={18} color="#b45309" aria-hidden="true" />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#334155', minWidth: 200 }}>{text}</span>
      <button type="button" onClick={onClick} style={ui.buttonSecondary}>{action}</button>
    </div>
  );
}

function Notice({ text, action, onClick }) {
  return (
    <div role="alert" style={{ ...ui.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', fontSize: 13 }}>
      <span style={{ flex: 1, minWidth: 200 }}>{text}</span>
      {action && <button type="button" onClick={onClick} style={ui.buttonSecondary}>{action}</button>}
    </div>
  );
}

/**
 * The first page: what needs attention (records waiting for review, fields on hold, people overdue for
 * training) and buttons for the records added most often. Everything else is one click away in the menu.
 */
export default function Home({ farm, farmProfile, role, lotCodeFormat, needsReviewCount = 0, reviewStatus = 'loading', botUsername = telegramBotUsername(), onNavigate, onOpenProfile, onChanged }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = homeText(lang).home;

  const holds = useFieldHolds({ farmId: farm.id });
  const training = useFarmRecords({ farmId: farm.id, kinds: TRAINING_KINDS });
  const [adding, setAdding] = useState(null); // null, or { kind, prefill }

  const today = todayLocalIso();
  const overdue = useMemo(() => trainingCounts(trainingDueList(training.records, { today })).overdue, [training.records, today]);
  const quickKinds = QUICK_KINDS.filter((kind) => canSeeKind(kind, role));
  // "All clear" is said only when everything was really read: a failed or cut-short read is not good news.
  const incomplete = holds.truncated || training.truncated;
  const allClear = reviewStatus === 'ready' && needsReviewCount === 0 && overdue === 0 && holds.status === 'ready' && holds.holds.length === 0 && training.status === 'ready' && !incomplete;
  const hasProfile = Boolean(farmProfile?.farm_name);

  return (
    <RecordsProviders farm={farm} lotCodeFormat={lotCodeFormat}>
      <div style={ui.page}>
        <h1 style={ui.h1}>{tt.title(farmProfile?.farm_name ?? farm.name)}</h1>
        <p style={{ ...ui.subtitle, marginBottom: 22 }}>{tt.subtitle}</p>

        {!hasProfile && (
          <div style={{ ...ui.card, borderColor: '#bfdbfe', background: '#eff6ff', padding: '14px 18px', marginBottom: 22, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px' }}>
              <div style={{ fontWeight: 700, color: '#1e3a8a' }}>{tt.setup}</div>
              <div style={{ fontSize: 13, color: '#1e40af' }}>{tt.setupBody}</div>
            </div>
            <button type="button" onClick={onOpenProfile} style={ui.buttonPrimary}>{tt.setupButton}</button>
          </div>
        )}

        <FieldHoldsBanner status={holds.status} holds={holds.holds} onRetry={holds.reload} onClear={(hold) => setAdding({ kind: 'corrective_action', prefill: { field: hold.name, clears_hold: 'yes' } })} />

        <h2 style={{ fontSize: 14, color: '#475569', margin: '0 0 10px' }}>{tt.attention}</h2>
        <div style={{ display: 'grid', gap: 10, marginBottom: 26 }}>
          {needsReviewCount > 0 && <AttentionRow icon={ClipboardCheck} text={tt.review(needsReviewCount)} action={tt.reviewOpen} onClick={() => onNavigate(ROUTES.review)} />}
          {overdue > 0 && <AttentionRow icon={GraduationCap} text={tt.training(overdue)} action={tt.trainingOpen} onClick={() => onNavigate(ROUTES.training)} />}
          {reviewStatus === 'error' && <Notice text={tt.reviewError} />}
          {training.status === 'error' && <Notice text={tt.trainingError} action={tt.retry} onClick={training.reload} />}
          {incomplete && <Notice text={tt.incomplete} />}
          {allClear && <div style={{ ...ui.card, padding: '14px 18px', color: '#166534', background: '#f0fdf4', borderColor: '#bbf7d0', fontSize: 14 }}>{tt.allClear}</div>}
        </div>

        <h2 style={{ fontSize: 14, color: '#475569', margin: '0 0 10px' }}>{tt.quickAdd}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
          {quickKinds.map((kind) => {
            const Icon = KIND_ICONS[KIND_META[kind].icon];
            return (
              <button key={kind} type="button" onClick={() => setAdding({ kind })} style={{ ...ui.card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0f172a', textAlign: 'left' }}>
                <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, background: `${KIND_META[kind].color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color={KIND_META[kind].color} aria-hidden="true" />
                </span>
                {KIND_META[kind].label[lang]}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => onNavigate(ROUTES.overview)} style={{ ...ui.buttonSecondary, marginBottom: 36 }}>
          <Plus size={14} aria-hidden="true" />{tt.allTypes}
        </button>

        {/* Shown only once the bot exists (its public name is set at build time), so nobody is offered something that cannot work. */}
        {botUsername && <TelegramConnect botUsername={botUsername} />}

        <footer style={{ borderTop: '1px solid #e2e8f0', paddingTop: 18, fontSize: 12, color: '#64748b' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{tt.resources}</div>
          <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', marginBottom: 16 }}>
            {RESOURCES.map((resource) => (
              <a key={resource.url} href={resource.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--u-navy)' }}>{resource.name}</a>
            ))}
          </div>
          <div>{tt.credit} <strong>Jimmy Nguyen</strong>. {tt.creditRole}.</div>
          <div>{tt.copyright}</div>
        </footer>

        {adding && (
          <RecordForm
            kind={adding.kind}
            role={role}
            farmId={farm.id}
            prefill={adding.prefill}
            onCancel={() => setAdding(null)}
            onSaved={() => {
              const kind = adding.kind;
              setAdding(null);
              onChanged?.();
              holds.reload();
              training.reload();
              onNavigate(logRoute(kind));
            }}
          />
        )}
      </div>
    </RecordsProviders>
  );
}
