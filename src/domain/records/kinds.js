/**
 * Vocabulary for food safety records: kinds, statuses, sources, and the fields of each kind.
 * This is the single source of truth. Validation, forms, tables and (later) the Telegram agent are
 * all derived from KIND_FIELDS. The database CHECK constraints mirror these lists, and a test keeps
 * them in sync.
 */

export const RECORD_KINDS = Object.freeze([
  'sanitizer_label', 'sanitizer_purchase', 'sanitation_log',
  'weather_event', 'wildlife_check', 'soil_amendment', 'water_test', 'water_assessment',
  'training', 'visitor', 'illness_injury',
  'harvest', 'packing_cooling', 'shipment', 'corrective_action',
  'note',
]);

/** Health information: only owners and managers may see these records (enforced by the database). */
export const RESTRICTED_KINDS = Object.freeze(['illness_injury']);

/** draft/needs_info: still being completed · pending_review: waiting for an owner/manager · voided: withdrawn, never deleted. */
export const RECORD_STATUSES = Object.freeze(['draft', 'needs_info', 'pending_review', 'approved', 'rejected', 'voided']);

export const RECORD_SOURCES = Object.freeze(['manual', 'web_upload', 'telegram', 'whatsapp', 'email', 'import']);

const opt = (value, en, es) => Object.freeze({ value, en, es });
const field = (key, type, en, es, extra = {}) => Object.freeze({ key, type, label: Object.freeze({ en, es }), ...extra });

const YES_NO = Object.freeze([opt('yes', 'Yes', 'Sí'), opt('no', 'No', 'No')]);
/** How worried a water assessment is about one thing it looks at. */
const CONCERN = Object.freeze([
  opt('low', 'Low concern', 'Poca preocupación'),
  opt('some', 'Some concern', 'Alguna preocupación'),
  opt('high', 'High concern', 'Mucha preocupación'),
]);
const SANITIZED = Object.freeze(['clean_sanitize', 'sanitize_only']);

const notesField = () => field('notes', 'textarea', 'Notes', 'Notas');
const fieldField = (extra = {}) => field('field', 'text', 'Field / block', 'Campo / bloque', extra);
const quantityFields = () => [field('quantity', 'number', 'Quantity', 'Cantidad'), field('unit', 'text', 'Unit', 'Unidad')];

export const KIND_FIELDS = Object.freeze({
  // ─── Sanitation ───────────────────────────────────────────────────────────
  sanitizer_label: Object.freeze([
    field('product', 'text', 'Product name', 'Nombre del producto', { required: true }),
    field('epa_reg_no', 'text', 'EPA registration no.', 'N.º de registro EPA'),
    field('active_ingredient', 'text', 'Active ingredient', 'Ingrediente activo'),
    field('approved_use', 'select', 'Approved use', 'Uso aprobado', {
      required: true,
      options: [
        opt('food_contact', 'Food-contact surfaces', 'Superficies en contacto con alimentos'),
        opt('produce_wash', 'Produce wash water', 'Agua de lavado de productos'),
        opt('both', 'Both', 'Ambos'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    field('ppm_min', 'number', 'Minimum ppm', 'ppm mínimo'),
    field('ppm_max', 'number', 'Maximum ppm', 'ppm máximo'),
    field('contact_time', 'text', 'Contact time', 'Tiempo de contacto'),
    field('ppe', 'text', 'Required PPE', 'EPP requerido'),
    notesField(),
  ]),
  sanitizer_purchase: Object.freeze([
    field('product', 'text', 'Product', 'Producto', { required: true }),
    field('supplier', 'text', 'Supplier', 'Proveedor', { required: true }),
    field('lot_number', 'text', 'Product lot number', 'N.º de lote del producto'),
    ...quantityFields(),
    field('total_cost', 'number', 'Total cost', 'Costo total'),
    field('invoice_number', 'text', 'Invoice #', 'N.º de factura'),
    notesField(),
  ]),
  sanitation_log: Object.freeze([
    field('item', 'text', 'Item or surface', 'Artículo o superficie', { required: true }),
    fieldField({ label: Object.freeze({ en: 'Field / area', es: 'Campo / área' }) }),
    field('method', 'select', 'What was done', 'Qué se hizo', {
      required: true,
      options: [
        opt('clean_sanitize', 'Cleaned, then sanitized', 'Limpiado y luego desinfectado'),
        opt('clean_only', 'Cleaned only', 'Solo limpiado'),
        opt('sanitize_only', 'Sanitized only', 'Solo desinfectado'),
      ],
    }),
    field('sanitizer', 'text', 'Sanitizer used', 'Desinfectante usado', { requiredWhen: { method: SANITIZED } }),
    field('ppm', 'number', 'Concentration (ppm)', 'Concentración (ppm)', { requiredWhen: { method: SANITIZED } }),
    field('check_result', 'select', 'Concentration check', 'Revisión de la concentración', {
      options: [
        opt('pass', 'Within the label range', 'Dentro del rango de la etiqueta'),
        opt('fail', 'Outside the label range', 'Fuera del rango de la etiqueta'),
        opt('not_tested', 'Not tested', 'No se probó'),
      ],
    }),
    field('performed_by', 'text', 'Done by', 'Realizado por'),
    notesField(),
  ]),

  // ─── Field and environment ────────────────────────────────────────────────
  weather_event: Object.freeze([
    field('event_type', 'select', 'Event', 'Evento', {
      required: true,
      options: [
        opt('flood', 'Flood', 'Inundación'),
        opt('heavy_rain', 'Heavy rain', 'Lluvia intensa'),
        opt('hail', 'Hail', 'Granizo'),
        opt('smoke_ash', 'Smoke or ash', 'Humo o ceniza'),
        opt('extreme_heat', 'Extreme heat', 'Calor extremo'),
        opt('wind', 'High wind', 'Viento fuerte'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    fieldField({ required: true, label: Object.freeze({ en: 'Field / block affected', es: 'Campo / bloque afectado' }) }),
    field('crop_contact', 'select', 'Did water, ash or debris reach the crop?', '¿El agua, la ceniza o los escombros llegaron al cultivo?', {
      required: true,
      options: [opt('yes', 'Yes', 'Sí'), opt('no', 'No', 'No'), opt('unknown', 'Not sure', 'No se sabe')],
    }),
    field('water_source', 'text', 'Water source it may have reached (if any)', 'Fuente de agua que pudo alcanzar (si hay)'),
    field('description', 'textarea', 'What happened', 'Qué pasó'),
    notesField(),
  ]),
  wildlife_check: Object.freeze([
    fieldField({ required: true }),
    field('evidence', 'select', 'Signs of animals found?', '¿Se encontraron señales de animales?', { required: true, options: YES_NO }),
    field('evidence_description', 'textarea', 'What was found', 'Qué se encontró', { requiredWhen: { evidence: 'yes' } }),
    field('no_harvest_zone', 'text', 'No-harvest zone marked', 'Zona de no cosecha marcada', { requiredWhen: { evidence: 'yes' } }),
    field('checked_by', 'text', 'Checked by', 'Revisado por'),
    notesField(),
  ]),
  soil_amendment: Object.freeze([
    field('amendment_type', 'select', 'Type', 'Tipo', {
      required: true,
      options: [
        opt('raw_manure', 'Raw manure', 'Estiércol crudo'),
        opt('compost', 'Compost (treated)', 'Composta (tratada)'),
        opt('biosolids', 'Treated biosolids', 'Biosólidos tratados'),
        opt('other_biological', 'Other biological', 'Otro biológico'),
        opt('synthetic', 'Synthetic (non-biological)', 'Sintético (no biológico)'),
      ],
    }),
    field('product', 'text', 'Product / source', 'Producto / origen'),
    fieldField({ required: true }),
    field('supplier', 'text', 'Supplier', 'Proveedor'),
    field('lot_number', 'text', 'Lot number', 'N.º de lote'),
    ...quantityFields(),
    field('method', 'select', 'How it was applied', 'Cómo se aplicó', {
      options: [
        opt('incorporated', 'Worked into the soil', 'Incorporado al suelo'),
        opt('surface', 'On the surface', 'En la superficie'),
        opt('side_dress', 'Side-dressed', 'Aplicado en banda lateral'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    notesField(),
  ]),
  water_test: Object.freeze([
    field('source', 'text', 'Water source', 'Fuente de agua', { required: true }),
    field('water_use', 'select', 'Water use', 'Uso del agua', {
      options: [
        opt('pre_harvest', 'Pre-harvest (irrigation)', 'Precosecha (riego)'),
        opt('harvest_postharvest', 'Harvest / post-harvest', 'Cosecha / poscosecha'),
        opt('handwashing', 'Handwashing / drinking', 'Lavado de manos / consumo'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    field('lab', 'text', 'Laboratory', 'Laboratorio'),
    field('sample_id', 'text', 'Sample ID', 'ID de la muestra'),
    field('result_value', 'number', 'Generic E. coli (CFU or MPN per 100 mL)', 'E. coli genérica (UFC o NMP por 100 mL)'),
    field('result', 'select', 'Result', 'Resultado', {
      required: true,
      options: [
        opt('pass', 'Meets the standard', 'Cumple la norma'),
        opt('fail', 'Does not meet the standard', 'No cumple la norma'),
        opt('pending', 'Waiting for the lab', 'Esperando al laboratorio'),
      ],
    }),
    notesField(),
  ]),
  // A pre-harvest agricultural water assessment: one water source, looked at the way 21 CFR 112.43 asks (the source and how the
  // water travels, what is near it, how it is applied, the crop, the weather, and test results). The person decides the conclusion.
  water_assessment: Object.freeze([
    field('source', 'text', 'Water source or system', 'Fuente o sistema de agua', { required: true }),
    field('source_type', 'select', 'What kind of source it is', 'Qué tipo de fuente es', {
      required: true,
      options: [
        opt('enclosed_groundwater', 'Groundwater: sealed, protected well', 'Agua subterránea: pozo sellado y protegido'),
        opt('open_groundwater', 'Groundwater: open or unprotected well', 'Agua subterránea: pozo abierto o sin protección'),
        opt('surface', 'Surface water: pond, river or stream', 'Agua superficial: estanque, río o arroyo'),
        opt('canal', 'Open canal or ditch', 'Canal o zanja abierta'),
        opt('public', 'Public water system', 'Sistema público de agua'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    field('fields_served', 'text', 'Fields this water is used on (separate with commas)', 'Campos donde se usa esta agua (separa con comas)', { required: true }),
    field('application_method', 'select', 'How the water is applied', 'Cómo se aplica el agua', {
      required: true,
      options: [
        opt('drip', 'Drip or underground (does not touch the harvested part)', 'Goteo o subterráneo (no toca la parte cosechada)'),
        opt('furrow', 'Furrow or flood (some contact is possible)', 'Surco o inundación (puede haber contacto)'),
        opt('overhead', 'Overhead or sprinkler (reaches the crop)', 'Aspersión o por encima (llega al cultivo)'),
        opt('other', 'Other or a mix', 'Otro o una mezcla'),
      ],
    }),
    field('days_before_harvest', 'number', 'Days between the last watering and harvest', 'Días entre el último riego y la cosecha'),
    field('source_concern', 'select', 'The source and how the water travels (location, open or closed pipes)', 'La fuente y cómo viaja el agua (ubicación, tuberías abiertas o cerradas)', { required: true, options: CONCERN }),
    field('nearby_concern', 'select', 'Animals, manure, compost or human waste on nearby land, and other water users', 'Animales, estiércol, composta o desechos humanos en terrenos cercanos, y otros usuarios del agua', { required: true, options: CONCERN }),
    field('practice_concern', 'select', 'How the water is applied, and the time before harvest', 'Cómo se aplica el agua y el tiempo antes de la cosecha', { required: true, options: CONCERN }),
    field('crop_concern', 'select', 'The crop (how easily germs stick to it or get inside)', 'El cultivo (qué tan fácil se pegan o entran los microbios)', { required: true, options: CONCERN }),
    field('weather_concern', 'select', 'The weather: heavy rain, flooding, extreme heat or sun', 'El clima: lluvia intensa, inundaciones, calor o sol extremos', { required: true, options: CONCERN }),
    field('testing_concern', 'select', 'Water test results', 'Resultados de análisis del agua', { required: true, options: [...CONCERN, opt('none', 'No test results', 'Sin resultados de análisis')] }),
    field('conclusion', 'select', 'What you decided', 'Lo que decidiste', {
      required: true,
      options: [
        opt('no_mitigation', 'No measures needed', 'No se necesitan medidas'),
        opt('mitigation_needed', 'Measures needed', 'Se necesitan medidas'),
      ],
    }),
    field('mitigation', 'textarea', 'The measures you will take, and by when', 'Las medidas que tomarás y para cuándo', { requiredWhen: { conclusion: 'mitigation_needed' } }),
    field('assessed_by', 'text', 'Assessed by', 'Evaluado por'),
    notesField(),
  ]),

  // ─── People ───────────────────────────────────────────────────────────────
  training: Object.freeze([
    field('topic', 'text', 'Topic', 'Tema', { required: true }),
    field('sop', 'text', 'SOP or reference', 'POE o referencia'),
    field('trainer', 'text', 'Trainer', 'Capacitador', { required: true }),
    field('attendees', 'textarea', 'People trained', 'Personas capacitadas', { required: true }),
    field('language', 'select', 'Language', 'Idioma', {
      options: [
        opt('en', 'English', 'Inglés'),
        opt('es', 'Spanish', 'Español'),
        opt('both', 'English and Spanish', 'Inglés y español'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    field('duration', 'text', 'Length', 'Duración'),
    notesField(),
  ]),
  visitor: Object.freeze([
    field('visitor_name', 'text', 'Visitor name', 'Nombre del visitante', { required: true }),
    field('company', 'text', 'Company', 'Empresa'),
    field('purpose', 'text', 'Purpose of visit', 'Motivo de la visita', { required: true }),
    field('time_in', 'text', 'Time in', 'Hora de entrada'),
    field('time_out', 'text', 'Time out', 'Hora de salida'),
    field('areas_visited', 'text', 'Areas visited', 'Áreas visitadas'),
    field('hygiene_briefing', 'select', 'Told the hygiene rules?', '¿Se le explicaron las reglas de higiene?', { required: true, options: YES_NO }),
    notesField(),
  ]),
  illness_injury: Object.freeze([
    field('person', 'text', 'Person', 'Persona', { required: true }),
    field('type', 'select', 'Illness or injury', 'Enfermedad o lesión', {
      required: true,
      options: [opt('illness', 'Illness', 'Enfermedad'), opt('injury', 'Injury', 'Lesión')],
    }),
    field('description', 'textarea', 'Symptoms or injury', 'Síntomas o lesión', { required: true }),
    field('removed_from_contact', 'select', 'Kept away from produce and food-contact surfaces?', '¿Se mantuvo alejado de los productos y de las superficies en contacto con alimentos?', {
      required: true,
      options: YES_NO,
    }),
    field('return_date', 'text', 'Return-to-work date', 'Fecha de regreso al trabajo'),
    field('affected', 'textarea', 'Produce or surfaces possibly affected', 'Productos o superficies posiblemente afectados'),
    notesField(),
  ]),

  // ─── Harvest and traceability ─────────────────────────────────────────────
  harvest: Object.freeze([
    field('crop', 'text', 'Crop', 'Cultivo', { required: true }),
    fieldField({ required: true }),
    field('quantity', 'number', 'Quantity', 'Cantidad', { required: true }),
    field('unit', 'text', 'Unit', 'Unidad', { required: true }),
    field('lot_code', 'text', 'Lot code', 'Código de lote'),
    field('crew', 'text', 'Harvest crew', 'Cuadrilla de cosecha'),
    field('destination', 'text', 'Destination / buyer', 'Destino / comprador'),
    notesField(),
  ]),
  packing_cooling: Object.freeze([
    field('lot_code', 'text', 'Lot code', 'Código de lote', { required: true }),
    field('product', 'text', 'Product / crop', 'Producto / cultivo'),
    ...quantityFields(),
    field('cooling_method', 'select', 'Cooling method', 'Método de enfriamiento', {
      options: [
        opt('hydrocooling', 'Hydrocooling', 'Hidroenfriamiento'),
        opt('forced_air', 'Forced air', 'Aire forzado'),
        opt('ice', 'Ice', 'Hielo'),
        opt('cold_room', 'Cold room', 'Cámara fría'),
        opt('none', 'Not cooled', 'Sin enfriar'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
    field('temperature', 'number', 'Product temperature', 'Temperatura del producto'),
    field('temperature_unit', 'select', 'Temperature unit', 'Unidad de temperatura', {
      options: [opt('f', '°F', '°F'), opt('c', '°C', '°C')],
    }),
    field('packed_by', 'text', 'Packed by', 'Empacado por'),
    notesField(),
  ]),
  shipment: Object.freeze([
    field('customer', 'text', 'Customer', 'Cliente', { required: true }),
    field('lot_codes', 'text', 'Lot codes shipped', 'Códigos de lote enviados', { required: true }),
    ...quantityFields(),
    field('invoice_number', 'text', 'Invoice #', 'N.º de factura'),
    field('carrier', 'text', 'Carrier / truck', 'Transportista / camión'),
    notesField(),
  ]),
  corrective_action: Object.freeze([
    field('problem', 'textarea', 'What happened', 'Qué pasó', { required: true }),
    field('affected', 'text', 'Fields or lots affected', 'Campos o lotes afectados'),
    field('action', 'textarea', 'Corrective action taken', 'Acción correctiva tomada', { required: true }),
    field('verified_by', 'text', 'Verified by', 'Verificado por'),
    field('clears_hold', 'select', 'Does this clear a field hold?', '¿Esto levanta una retención de campo?', { options: YES_NO }),
    fieldField({
      requiredWhen: { clears_hold: 'yes' },
      label: Object.freeze({ en: 'Field whose hold this clears', es: 'Campo cuya retención se levanta' }),
    }),
    notesField(),
  ]),

  note: Object.freeze([
    field('text', 'textarea', 'Note', 'Nota', { required: true }),
    field('category', 'select', 'Category', 'Categoría', {
      options: [
        opt('general', 'General', 'General'),
        opt('observation', 'Observation', 'Observación'),
        opt('inspection', 'Inspection or audit', 'Inspección o auditoría'),
        opt('other', 'Other', 'Otro'),
      ],
    }),
  ]),
});

const meta = (en, es, pluralEn, pluralEs, icon, color) =>
  Object.freeze({ label: Object.freeze({ en, es }), plural: Object.freeze({ en: pluralEn, es: pluralEs }), icon, color });

/** Display metadata. `icon` names a lucide-react icon; `plural` is the page title. */
export const KIND_META = Object.freeze({
  sanitizer_label: meta('Sanitizer label', 'Etiqueta de desinfectante', 'Sanitizer Labels', 'Etiquetas de Desinfectantes', 'FlaskConical', '#0891b2'),
  sanitizer_purchase: meta('Sanitizer purchase', 'Compra de desinfectante', 'Sanitizer Purchases', 'Compras de Desinfectantes', 'ShoppingCart', '#db2777'),
  sanitation_log: meta('Cleaning & sanitizing', 'Limpieza y desinfección', 'Sanitation Log', 'Registro de Limpieza', 'SprayCan', '#0284c7'),
  weather_event: meta('Weather event', 'Evento climático', 'Weather Events', 'Eventos Climáticos', 'CloudRain', '#4f46e5'),
  wildlife_check: meta('Wildlife check', 'Revisión de fauna', 'Wildlife Checks', 'Revisiones de Fauna', 'PawPrint', '#a16207'),
  soil_amendment: meta('Soil amendment', 'Enmienda del suelo', 'Soil Amendments', 'Enmiendas del Suelo', 'Shovel', '#0f766e'),
  water_test: meta('Water test', 'Análisis de agua', 'Water Tests', 'Análisis de Agua', 'Droplets', '#2563eb'),
  water_assessment: meta('Water assessment', 'Evaluación del agua', 'Water Assessments', 'Evaluaciones del Agua', 'Waves', '#0369a1'),
  training: meta('Training', 'Capacitación', 'Training Log', 'Registro de Capacitación', 'GraduationCap', '#7c3aed'),
  visitor: meta('Visitor', 'Visitante', 'Visitor Log', 'Registro de Visitantes', 'UserCheck', '#475569'),
  illness_injury: meta('Illness or injury', 'Enfermedad o lesión', 'Illness & Injury Reports', 'Reportes de Enfermedad y Lesiones', 'HeartPulse', '#dc2626'),
  harvest: meta('Harvest', 'Cosecha', 'Harvest Log', 'Registro de Cosecha', 'Wheat', '#d97706'),
  packing_cooling: meta('Packing & cooling', 'Empaque y enfriamiento', 'Packing & Cooling', 'Empaque y Enfriamiento', 'Snowflake', '#0891b2'),
  shipment: meta('Shipment', 'Envío', 'Shipments', 'Envíos', 'Truck', '#ea580c'),
  corrective_action: meta('Corrective action', 'Acción correctiva', 'Corrective Actions', 'Acciones Correctivas', 'Wrench', '#b91c1c'),
  note: meta('Note', 'Nota', 'Notes', 'Notas', 'StickyNote', '#64748b'),
});

const group = (id, en, es, kinds) => Object.freeze({ id, label: Object.freeze({ en, es }), kinds: Object.freeze(kinds) });

/** How the record kinds are grouped in the menu. Every kind appears in exactly one group. */
export const KIND_GROUPS = Object.freeze([
  group('sanitation', 'Sanitation', 'Saneamiento', ['sanitation_log', 'sanitizer_label', 'sanitizer_purchase']),
  group('field', 'Field & environment', 'Campo y ambiente', ['weather_event', 'wildlife_check', 'soil_amendment', 'water_test', 'water_assessment']),
  group('people', 'People', 'Personas', ['training', 'visitor', 'illness_injury']),
  group('harvest', 'Harvest & traceability', 'Cosecha y trazabilidad', ['harvest', 'packing_cooling', 'shipment', 'corrective_action']),
  group('other', 'Other', 'Otros', ['note']),
]);

/** Whether a payload value meets a `requiredWhen` condition (one value, or any of a list). */
const meets = (value, wanted) => (Array.isArray(wanted) ? wanted.includes(value) : value === wanted);

/**
 * Keys of the fields that must be filled before a record can be reviewed, given what is known so
 * far. Some fields are required only in some cases (a sanitizing step needs the sanitizer and its
 * concentration; signs of animals need a description and a no-harvest zone); those are the
 * follow-up questions the Telegram agent asks.
 *
 * @param {string} kind
 * @param {Record<string, unknown>} payload
 * @returns {string[]}
 */
export function requiredFieldKeys(kind, payload) {
  return KIND_FIELDS[kind]
    .filter((f) => f.required || (f.requiredWhen && Object.entries(f.requiredWhen).every(([k, v]) => meets(payload?.[k], v))))
    .map((f) => f.key);
}

/**
 * @param {string} kind
 * @param {string} fieldKey
 * @param {string} value
 * @param {'en' | 'es'} lang
 * @returns {string} the localized option label, or the raw value if unknown
 */
export function optionLabel(kind, fieldKey, value, lang) {
  const found = KIND_FIELDS[kind]?.find((f) => f.key === fieldKey)?.options?.find((o) => o.value === value);
  return found ? found[lang === 'es' ? 'es' : 'en'] : value;
}
