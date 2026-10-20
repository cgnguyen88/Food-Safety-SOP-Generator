import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { formatNumber } from './format.js';
import { recordsText } from './text.js';
import * as ui from './ui.js';

const td = { padding: '10px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const small = { ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 };
const smallDanger = { ...ui.buttonDanger, padding: '3px 10px', fontSize: 12 };
const off = (disabled) => (disabled ? ui.buttonDisabled : {});

/**
 * One field in the list, from `summarizeFields`. What depends on the farm's records (the counts, and whether the
 * name can change or the field can be deleted) shows as a dash, and its buttons stay off, until they are read.
 * A field records use shows Delete as unavailable (the page explains when it is pressed).
 */
export default function FieldRow({ summary, recordsReady, hold = null, canManage, busy, onDetails, onEdit, onToggleActive, onDelete }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).fields;
  const holdText = recordsText(lang).holds;
  const none = tt.detail.none;
  const column = tt.columns;

  const { field } = summary;
  const archived = !field.is_active;
  const muted = archived ? { color: '#94a3b8' } : null;
  const area = field.area !== null && field.area !== undefined && field.area_unit ? `${formatNumber(field.area, lang)} ${tt.units[field.area_unit] ?? ''}`.trim() : none;
  const waiting = !recordsReady || busy;
  const inUse = recordsReady && summary.uses > 0;

  return (
    <tr>
      <td className="stack-title" style={{ ...td, ...muted }}>
        <div style={{ fontWeight: 600, color: archived ? '#94a3b8' : '#0f172a' }}>
          {field.name}
          {hold && <> <span title={holdText.since(hold.since)} style={{ ...ui.TONES.danger, marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{holdText.badge}</span></>}
        </div>
        {field.notes && <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{field.notes}</div>}
      </td>
      <td data-label={column.area} style={{ ...td, ...muted, whiteSpace: 'nowrap' }}>{area}</td>
      <td data-label={column.crops} style={{ ...td, ...muted }}>{recordsReady && summary.crops.length > 0 ? summary.crops.join(', ') : none}</td>
      <td data-label={column.records} style={{ ...td, ...muted }}>{recordsReady ? String(summary.uses) : none}</td>
      <td data-label={column.lastWildlifeCheck} style={{ ...td, ...muted, whiteSpace: 'nowrap' }}>{(recordsReady && summary.lastWildlifeCheck) || none}</td>
      <td data-label={column.lastHarvest} style={{ ...td, ...muted, whiteSpace: 'nowrap' }}>{(recordsReady && summary.lastHarvest) || none}</td>
      <td data-label={column.status} style={td}>
        <span style={{ ...(archived ? ui.TONES.muted : ui.TONES.success), padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
          {archived ? tt.status.archived : tt.status.active}
        </span>
      </td>
      <td className="stack-actions" style={{ ...td, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" aria-label={`${tt.actions.details} ${field.name}`} disabled={!recordsReady} onClick={onDetails} style={{ ...small, ...off(!recordsReady) }}>{tt.actions.details}</button>
          {canManage && (
            <>
              <button type="button" aria-label={`${tt.actions.edit} ${field.name}`} disabled={waiting} onClick={onEdit} style={{ ...small, ...off(waiting) }}>{tt.actions.edit}</button>
              <button type="button" aria-label={`${archived ? tt.actions.restore : tt.actions.archive} ${field.name}`} disabled={busy} onClick={onToggleActive} style={{ ...small, ...off(busy) }}>
                {archived ? tt.actions.restore : tt.actions.archive}
              </button>
              {/* Every field has the same buttons. When records use the field it cannot be deleted, so the button looks off and
                  says why: it stays pressable (a disabled one says nothing on a phone), and pressing it explains. */}
              <button
                type="button"
                aria-label={`${tt.actions.delete} ${field.name}`}
                aria-disabled={inUse || undefined}
                title={inUse ? tt.errors.in_use_delete : undefined}
                disabled={waiting}
                onClick={onDelete}
                style={{ ...smallDanger, ...off(waiting || inUse) }}
              >
                {tt.actions.delete}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
