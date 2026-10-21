import { KIND_FIELDS, KIND_META, optionLabel } from './kinds.js';
import { cleanText } from './csv.js';
import { todayLocalIso } from './seasons.js';

/**
 * Turns farm records into a report a person can hand to an inspector or certifier. One model feeds
 * every output (the on-screen/print view, the Word file and the CSV), so they always agree.
 *
 * Rules that protect the reader of the report, enforced here rather than trusted from the caller:
 *   - voided and rejected records never appear (a reviewer said they are wrong, or they were withdrawn);
 *   - records still being worked on (draft, needs info, waiting for review) appear only when the caller says so,
 *     and then each row shows its status.
 */

/**
 * The order a food safety auditor usually reads records in: people first (training, visitors, health),
 * then sanitation, water and soil, the field checks, and last what was harvested, packed and shipped.
 */
export const REPORT_KIND_ORDER = Object.freeze([
  'training', 'visitor', 'illness_injury',
  'sanitizer_label', 'sanitizer_purchase', 'sanitation_log',
  'water_assessment', 'water_test', 'soil_amendment', 'wildlife_check', 'weather_event',
  'harvest', 'packing_cooling', 'shipment', 'corrective_action',
  'note',
]);

export const REPORT_TEXT = Object.freeze({
  en: {
    title: 'Food Safety Records Report',
    header: { operation: 'Operation', farmCode: 'Farm code', owner: 'Owner / operator', foodSafetyManager: 'Food safety manager', address: 'Address', auditor: 'Auditor', fsmaStatus: 'FSMA status', period: 'Period', reportDate: 'Report date', records: 'Records' },
    scope: { approved: 'Approved records only', all: 'Includes records not yet approved' },
    period: { all: 'All dates', range: (from, to) => `${from} to ${to}`, from: (date) => `From ${date}`, upTo: (date) => `Up to ${date}` },
    columns: { date: 'Date', type: 'Type', status: 'Status', source: 'Source', approved: 'Approved' },
    undated: 'No date',
    continued: 'continued',
    status: { draft: 'Draft', needs_info: 'Needs info', pending_review: 'Needs review', approved: 'Approved', rejected: 'Rejected', voided: 'Voided' },
    source: { manual: 'Entered by hand', web_upload: 'Web upload', telegram: 'Telegram', whatsapp: 'WhatsApp', email: 'Email', import: 'Imported' },
    count: (n) => (n === 1 ? '1 record' : `${n} records`),
    summary: 'Summary',
    empty: 'There are no records for this selection.',
    truncated: 'This list was cut short because it is very long. Narrow the period to see everything.',
    signature: { preparedBy: 'Prepared by', signature: 'Signature', date: 'Date' },
    page: 'Page',
    footer: 'Compiled from the farm’s food safety records. This is a copy of what was recorded and is not a statement of compliance.',
  },
  es: {
    title: 'Informe de Registros de Inocuidad Alimentaria',
    header: { operation: 'Operación', farmCode: 'Código de la granja', owner: 'Propietario / operador', foodSafetyManager: 'Gerente de inocuidad alimentaria', address: 'Dirección', auditor: 'Auditor', fsmaStatus: 'Estado FSMA', period: 'Período', reportDate: 'Fecha del informe', records: 'Registros' },
    scope: { approved: 'Solo registros aprobados', all: 'Incluye registros aún no aprobados' },
    period: { all: 'Todas las fechas', range: (from, to) => `${from} a ${to}`, from: (date) => `Desde ${date}`, upTo: (date) => `Hasta ${date}` },
    columns: { date: 'Fecha', type: 'Tipo', status: 'Estado', source: 'Origen', approved: 'Aprobado' },
    undated: 'Sin fecha',
    continued: 'continuación',
    status: { draft: 'Borrador', needs_info: 'Faltan datos', pending_review: 'Por revisar', approved: 'Aprobado', rejected: 'Rechazado', voided: 'Anulado' },
    source: { manual: 'Ingresado a mano', web_upload: 'Carga web', telegram: 'Telegram', whatsapp: 'WhatsApp', email: 'Correo', import: 'Importado' },
    count: (n) => (n === 1 ? '1 registro' : `${n} registros`),
    summary: 'Resumen',
    empty: 'No hay registros para esta selección.',
    truncated: 'La lista se cortó porque es muy larga. Reduce el período para ver todo.',
    signature: { preparedBy: 'Preparado por', signature: 'Firma', date: 'Fecha' },
    page: 'Página',
    footer: 'Compilado a partir de los registros de inocuidad de la granja. Es una copia de lo que se registró y no una declaración de cumplimiento.',
  },
});

const textFor = (lang) => REPORT_TEXT[lang === 'es' ? 'es' : 'en'];
const present = (value) => value !== undefined && value !== null && value !== '';
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The local calendar date of a timestamp ('' if there is none, or it cannot be read), so it agrees with the report date. */
function dayOf(timestamp) {
  if (typeof timestamp !== 'string') return '';
  if (PLAIN_DATE.test(timestamp)) return timestamp;
  const moment = new Date(timestamp);
  return Number.isNaN(moment.getTime()) ? '' : todayLocalIso(moment);
}

/** A quantity or temperature and its unit read as one cell ("40 cartons", "34 °F") in the report; the CSV keeps them apart. */
const UNIT_OF = Object.freeze({ quantity: 'unit', temperature: 'temperature_unit' });
const HIDDEN_UNIT_KEYS = new Set(Object.values(UNIT_OF));

const SHOWN_WHEN_APPROVED = ['approved'];
const SHOWN_WHEN_UNAPPROVED_TOO = ['approved', 'draft', 'needs_info', 'pending_review'];

/** The statuses a report may show (also what a report's database query asks for). */
export const reportStatuses = (includeUnapproved) => [...(includeUnapproved ? SHOWN_WHEN_UNAPPROVED_TOO : SHOWN_WHEN_APPROVED)];

/** The records a report may show: known kinds only, approved ones unless asked for work in progress too. */
function visibleRecords(records, includeUnapproved) {
  const allowed = reportStatuses(includeUnapproved);
  return records.filter((r) => KIND_FIELDS[r.kind] && allowed.includes(r.status));
}

const byDateThenCreated = (a, b) => {
  if (a.record_date !== b.record_date) {
    if (!a.record_date) return 1;
    if (!b.record_date) return -1;
    return a.record_date < b.record_date ? -1 : 1;
  }
  return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
};

/** One value as a spreadsheet or table cell: numbers stay numbers, choices read by name. */
function cellValue(record, field, lang) {
  const value = record.payload?.[field.key];
  if (!present(value)) return '';
  if (field.type === 'number') return value;
  if (field.type === 'select') return optionLabel(record.kind, field.key, value, lang);
  return value;
}

/** The fields a kind shows in a report: a unit that is written next to its quantity is not a column of its own. */
function fieldsOf(kind) {
  const all = KIND_FIELDS[kind];
  const shownBesideQuantity = new Set(Object.entries(UNIT_OF).filter(([base]) => all.some((f) => f.key === base)).map(([, unit]) => unit));
  return all.filter((f) => !shownBesideQuantity.has(f.key));
}

/** Blank lines come down to one, and none at either end, so a stray run of them cannot take up pages. */
const tidyLines = (text) => text.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');

/** The text of one report cell (a quantity gets its unit appended). */
function reportCell(record, field, lang) {
  const base = cellValue(record, field, lang);
  const unitKey = UNIT_OF[field.key];
  const unitField = unitKey && KIND_FIELDS[record.kind].find((f) => f.key === unitKey);
  const unit = unitField ? cellValue(record, unitField, lang) : '';
  if (unitField && unit !== '') return tidyLines(cleanText(base === '' ? unit : `${base} ${unit}`));
  return tidyLines(cleanText(base));
}

/**
 * A log with more fields than this is laid out by date: across a page its columns would be squeezed too narrow to read, so
 * each record becomes a column headed by its date, with the fields listed down the side (see `recordTables`).
 */
export const MAX_FIELDS_ACROSS = 8;

/** How many records of a log laid out by date go side by side in one table; more are carried over to a table below. */
export const RECORDS_PER_TABLE = 4;

function buildSection(kind, records, includeUnapproved, lang, text) {
  const sorted = [...records].sort(byDateThenCreated);
  const fields = fieldsOf(kind).filter((field) => sorted.some((r) => present(r.payload?.[field.key]) || (UNIT_OF[field.key] && present(r.payload?.[UNIT_OF[field.key]]))));

  const approvedOn = (r) => (r.status === 'approved' ? dayOf(r.reviewed_at) : '');
  const columns = [
    { key: 'record_date', label: text.columns.date },
    ...fields.map((f) => ({ key: f.key, label: f.label[lang] })),
    ...(includeUnapproved ? [{ key: 'status', label: text.columns.status }] : []),
    ...(sorted.some((r) => approvedOn(r) !== '') ? [{ key: 'approved', label: text.columns.approved }] : []),
  ];

  const rows = sorted.map((r) => [
    cleanText(r.record_date),
    ...fields.map((f) => reportCell(r, f, lang)),
    ...(includeUnapproved ? [cleanText(text.status[r.status] ?? r.status)] : []),
    ...(columns.some((c) => c.key === 'approved') ? [approvedOn(r)] : []),
  ]);

  const layout = fields.length > MAX_FIELDS_ACROSS ? 'by_date' : 'table';
  return { kind, title: KIND_META[kind].plural[lang], count: sorted.length, layout, undated: text.undated, columns, rows };
}

/**
 * A section laid out by date as tables: the records side by side, each a column headed by its date, with the name of every
 * field down the left. At most `perTable` records share a table; the rest go in the tables below, marked `continued`.
 * Each table holds only the dates it shows, so every one reads on its own.
 *
 * @param {{ columns: Array<{ key: string, label: string }>, rows: Array<Array<string | number>>, undated?: string }} section
 * @param {number} [perTable]
 * @returns {Array<{ continued: boolean, dates: string[], rows: Array<{ key: string, label: string, values: Array<string | number> }> }>}
 */
export function recordTables(section, perTable = RECORDS_PER_TABLE) {
  const size = Math.max(1, Math.floor(perTable) || 1);
  const fieldColumns = section.columns.slice(1);
  const tables = [];
  for (let start = 0; start < section.rows.length; start += size) {
    const chunk = section.rows.slice(start, start + size);
    tables.push({
      continued: start > 0,
      dates: chunk.map((row) => row[0] || section.undated || ''),
      rows: fieldColumns.map((column, index) => ({ key: column.key, label: column.label, values: chunk.map((row) => row[index + 1]) })),
    });
  }
  return tables;
}

/**
 * @param {{ type?: 'all' | 'range', from?: string, to?: string } | null | undefined} period `to` is the last day, inclusive
 * @param {string} lang
 * @returns {string}
 */
export function describePeriod(period, lang) {
  const text = textFor(lang).period;
  if (!period || (!period.from && !period.to)) return text.all;
  if (period.from && period.to) return text.range(period.from, period.to);
  return period.from ? text.from(period.from) : text.upTo(period.to);
}

/**
 * @param {{
 *   records: object[], farm: { name?: string, farm_code?: string },
 *   operation?: { operationName?: string, ownerName?: string, foodSafetyManager?: string, address?: string, auditor?: string, fsmaStatus?: string },
 *   title?: string, period?: object | null, lang?: string, generatedOn: string,
 *   includeUnapproved?: boolean, truncated?: boolean,
 * }} input
 */
export function buildReport({ records, farm, operation = {}, title, period = null, lang = 'en', generatedOn, includeUnapproved = false, truncated = false }) {
  const language = lang === 'es' ? 'es' : 'en';
  const text = textFor(language);
  const shown = visibleRecords(records, includeUnapproved);

  const sections = REPORT_KIND_ORDER
    .map((kind) => [kind, shown.filter((r) => r.kind === kind)])
    .filter(([, list]) => list.length > 0)
    .map(([kind, list]) => buildSection(kind, list, includeUnapproved, language, text));

  const header = [
    [text.header.operation, operation.operationName || farm?.name],
    [text.header.farmCode, farm?.farm_code],
    [text.header.owner, operation.ownerName],
    [text.header.foodSafetyManager, operation.foodSafetyManager],
    [text.header.address, operation.address],
    [text.header.auditor, operation.auditor],
    [text.header.fsmaStatus, operation.fsmaStatus],
    [text.header.period, describePeriod(period, language)],
    [text.header.reportDate, generatedOn],
    [text.header.records, includeUnapproved ? text.scope.all : text.scope.approved],
  ]
    .map(([label, value]) => ({ label, value: cleanText(value) }))
    .filter((row) => row.value !== '');

  return {
    lang: language,
    text,
    title: cleanText(title) || text.title,
    header,
    sections,
    total: shown.length,
    truncated: Boolean(truncated),
  };
}

/**
 * One flat table of the records, for spreadsheets: a column for every field of every kind present,
 * quantities and units kept apart so a column can be summed.
 *
 * @param {object[]} records
 * @param {string} lang
 * @param {{ includeUnapproved?: boolean, truncated?: boolean }} [options] `truncated` adds a last line saying the list is cut short
 * @returns {Array<Array<string | number>>} a header row, then one row per record, oldest first
 */
export function recordsToCsvRows(records, lang, { includeUnapproved = false, truncated = false } = {}) {
  const language = lang === 'es' ? 'es' : 'en';
  const text = textFor(language);
  const shown = [...visibleRecords(records, includeUnapproved)].sort(byDateThenCreated);
  const kinds = REPORT_KIND_ORDER.filter((kind) => shown.some((r) => r.kind === kind));
  const mixed = kinds.length > 1;

  // One column per field and name: "Quantity" is shared by harvests and shipments, but a label's
  // "Product name" and a purchase's "Product" stay apart.
  const columns = [];
  for (const kind of kinds) {
    for (const f of KIND_FIELDS[kind]) {
      const label = f.label[language];
      if (!columns.some((c) => c.key === f.key && c.label === label)) columns.push({ key: f.key, label });
    }
  }

  const header = [text.columns.date, ...(mixed ? [text.columns.type] : []), ...columns.map((c) => c.label), text.columns.status, text.columns.source, text.columns.approved];
  const rows = shown.map((r) => [
    r.record_date ?? '',
    ...(mixed ? [KIND_META[r.kind].label[language]] : []),
    ...columns.map((c) => {
      const own = KIND_FIELDS[r.kind].find((g) => g.key === c.key && g.label[language] === c.label);
      return own ? cellValue(r, own, language) : '';
    }),
    text.status[r.status] ?? r.status,
    text.source[r.source] ?? r.source ?? '',
    dayOf(r.reviewed_at),
  ]);
  return [header, ...rows, ...(truncated ? [[text.truncated]] : [])];
}

/** What each check looks for, in approved records. */
const CHECKS = Object.freeze([
  ['sanitizer_out_of_range', (r) => r.kind === 'sanitation_log' && r.payload?.check_result === 'fail'],
  ['water_test_failed', (r) => r.kind === 'water_test' && r.payload?.result === 'fail'],
  ['animal_signs', (r) => r.kind === 'wildlife_check' && r.payload?.evidence === 'yes'],
  ['crop_contact', (r) => r.kind === 'weather_event' && r.payload?.crop_contact === 'yes'],
]);

/**
 * Things worth a look BEFORE a report is handed over: findings an auditor will expect a corrective
 * action for. These are shown to the farmer on screen only; they are not written into the report.
 *
 * @param {object[]} records
 * @returns {Array<{ code: 'sanitizer_out_of_range' | 'water_test_failed' | 'animal_signs' | 'crop_contact', count: number }>}
 */
export function reviewChecks(records) {
  const approved = records.filter((r) => r.status === 'approved');
  return CHECKS
    .map(([code, matches]) => ({ code, count: approved.filter(matches).length }))
    .filter((check) => check.count > 0);
}

const MAX_SLUG = 40;
const slug = (value) =>
  cleanText(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG).replace(/-+$/g, '');

/**
 * A plain file name: lowercase letters, digits and dashes only, so it can never act as a path.
 * @param {{ farm?: { name?: string }, scope?: string, generatedOn: string, ext: 'csv' | 'docx', partial?: boolean }} input
 *   `partial` marks a list that was cut short, so the file name says so too
 */
export function reportFileName({ farm, scope, generatedOn, ext, partial = false }) {
  const extension = ext === 'docx' ? 'docx' : 'csv';
  const parts = ['food-safety-records', slug(farm?.name) || 'farm', slug(scope), partial ? 'partial' : '', slug(generatedOn)].filter(Boolean);
  return `${parts.join('_')}.${extension}`;
}

const PROFILE_TO_OPERATION = Object.freeze([
  ['farm_name', 'operationName'],
  ['owner_name', 'ownerName'],
  ['food_safety_manager', 'foodSafetyManager'],
  ['address', 'address'],
  ['certifier', 'auditor'],
  ['fsma_status', 'fsmaStatus'],
]);

/**
 * The report header's details, from the farm profile (which the whole team shares). Phone numbers and
 * emails are not put on reports.
 *
 * @param {Record<string, unknown> | null | undefined} profile
 * @returns {{ operationName?: string, ownerName?: string, foodSafetyManager?: string, address?: string, auditor?: string, fsmaStatus?: string }}
 */
export function operationFromFarmProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  return Object.fromEntries(
    PROFILE_TO_OPERATION
      .map(([from, to]) => [to, profile[from]])
      .filter(([, value]) => typeof value === 'string' && value.trim() !== ''),
  );
}
