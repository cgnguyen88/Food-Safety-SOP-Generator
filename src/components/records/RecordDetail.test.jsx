// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ listRevisions: vi.fn(), advanceRecord: vi.fn(), updateRecord: vi.fn(), createRecord: vi.fn() }));
vi.mock('../../lib/attachments.js', () => ({ getAttachmentUrl: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
vi.mock('../../lib/fields.js', () => ({ addFieldsByName: vi.fn() }));
const db = await import('../../lib/attachments.js');
const records = await import('../../lib/records.js');
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: RecordDetail } = await import('./RecordDetail.jsx');
const { FarmFieldsContext } = await import('./farmFields.js');

const base = { id: 'r1', kind: 'sanitation_log', status: 'pending_review', record_date: '2026-10-01', source: 'telegram', confidence: 0.82, created_at: '2026-10-01T12:00:00Z', reviewed_at: null, created_by: 'crew-1', missing_fields: [], payload: { item: 'Harvest bins', field: 'B4', method: 'clean_sanitize', sanitizer: 'Chlorine', ppm: 150 } };

const setup = (record = base, props = {}, lang = 'en') => {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  const user = userEvent.setup();
  renderWithLang(<RecordDetail record={record} role="owner" userId="owner-1" farm={{ id: 'farm-1' }} onClose={onClose} onChanged={onChanged} {...props} />, lang);
  return { user, onClose, onChanged };
};

beforeEach(() => {
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue({ data: { records: [], truncated: false }, error: null });
  Object.values(records).forEach((fn) => fn.mockReset());
  records.listRevisions.mockResolvedValue({ data: [
    { id: 1, version: 1, change_type: 'created', changed_at: '2026-10-01T12:00:00Z', changed_by: 'crew-1' },
    { id: 2, version: 2, change_type: 'status:approved', changed_at: '2026-10-02T09:00:00Z', changed_by: 'owner-1' },
  ], error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('RecordDetail: content', () => {
  it('shows the record’s fields with localized labels and option values', async () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    for (const [label, value] of [['Item or surface', 'Harvest bins'], ['Field / area', 'B4'], ['What was done', 'Cleaned, then sanitized'], ['Sanitizer used', 'Chlorine'], ['Concentration (ppm)', '150']]) {
      const row = screen.getByText(label).closest('[data-testid="detail-row"]');
      expect(within(row).getByText(value), label).toBeTruthy();
    }
    await screen.findByText('Approved');
  });

  it('shows the status, source and reading confidence', async () => {
    setup();
    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0);
    expect(screen.getByText('Telegram')).toBeTruthy();
    expect(screen.getByText('82%')).toBeTruthy();
    await screen.findByText('Approved');
  });

  it('shows what is missing on an incomplete record', async () => {
    setup({ ...base, status: 'needs_info', missing_fields: ['sanitizer', 'ppm'], payload: { item: 'Harvest bins', field: 'B4', method: 'clean_sanitize' } });
    expect(screen.getByText(/Missing:/).textContent).toMatch(/Sanitizer used, Concentration \(ppm\)/);
    await screen.findByText('Created');
  });

  it('loads and shows the change history', async () => {
    setup();
    expect(await screen.findByText('Created')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(records.listRevisions).toHaveBeenCalledWith({ farmId: 'farm-1', recordId: 'r1' });
  });

  it('shows Spanish labels', async () => {
    setup(base, {}, 'es');
    expect(screen.getByText('Qué se hizo')).toBeTruthy();
    expect(screen.getByText('Limpiado y luego desinfectado')).toBeTruthy();
    await screen.findByText('Creado');
  });

  it('closes from the Close button and from Escape', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
    await screen.findByText('Created');
  });
});

describe('RecordDetail: actions follow the role', () => {
  const buttons = () => screen.queryAllByRole('button').map((b) => b.textContent);

  it('gives an owner approve, reject, ask-for-details, void and edit on a pending record', async () => {
    setup();
    expect(buttons()).toEqual(expect.arrayContaining(['Approve', 'Reject', 'Ask for details', 'Void', 'Edit']));
    await screen.findByText('Created');
  });

  it('gives an owner only Void and Edit on an approved record', async () => {
    setup({ ...base, status: 'approved' });
    expect(buttons()).toEqual(expect.arrayContaining(['Void', 'Edit']));
    for (const name of ['Approve', 'Reject', 'Ask for details']) expect(buttons()).not.toContain(name);
    await screen.findByText('Created');
  });

  it('gives crew an Edit button only on their own unreviewed record, and nothing else', async () => {
    setup(base, { role: 'crew', userId: 'crew-1' });
    expect(buttons()).toContain('Edit');
    for (const name of ['Approve', 'Reject', 'Void', 'Ask for details']) expect(buttons()).not.toContain(name);
    await screen.findByText('Created');
  });

  it('gives crew nothing on someone else’s record or an approved one', async () => {
    setup(base, { role: 'crew', userId: 'crew-2' });
    expect(buttons()).not.toContain('Edit');
    cleanup();
    setup({ ...base, status: 'approved' }, { role: 'crew', userId: 'crew-1' });
    expect(buttons()).not.toContain('Edit');
    await screen.findByText('Created');
  });

  it('lets crew send their own draft for review, and only their own', async () => {
    records.advanceRecord.mockResolvedValue({ data: { ...base, status: 'pending_review' }, error: null });
    const { user, onChanged } = setup({ ...base, status: 'draft' }, { role: 'crew', userId: 'crew-1' });
    expect(buttons()).toContain('Submit for review');
    for (const name of ['Approve', 'Reject', 'Void']) expect(buttons()).not.toContain(name);
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['pending_review']));
    expect(onChanged).toHaveBeenCalled();
    cleanup();
    setup({ ...base, status: 'needs_info' }, { role: 'crew', userId: 'crew-9' });
    expect(buttons()).not.toContain('Submit for review');
    await screen.findByText('Created');
  });

  it('offers nothing on a voided record', async () => {
    setup({ ...base, status: 'voided' });
    for (const name of ['Approve', 'Reject', 'Void', 'Edit', 'Ask for details']) expect(buttons()).not.toContain(name);
    await screen.findByText('Created');
  });
});

describe('RecordDetail: acting', () => {
  it('approves and tells the parent, showing the new status', async () => {
    records.advanceRecord.mockResolvedValue({ data: { ...base, status: 'approved' }, error: null });
    const { user, onChanged } = setup();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['approved']));
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    await screen.findByText('Created');
  });

  it('asks for confirmation before voiding and does nothing if declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup({ ...base, status: 'approved' });
    await user.click(screen.getByRole('button', { name: 'Void' }));
    expect(confirm).toHaveBeenCalled();
    expect(records.advanceRecord).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    records.advanceRecord.mockResolvedValue({ data: { ...base, status: 'voided' }, error: null });
    await user.click(screen.getByRole('button', { name: 'Void' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['voided']));
    confirm.mockRestore();
  });

  it('explains a refused action', async () => {
    records.advanceRecord.mockResolvedValue({ data: null, error: { code: 'invalid_transition' } });
    const { user, onChanged } = setup();
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not allowed/i);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('opens the edit form and reports a saved edit', async () => {
    records.updateRecord.mockResolvedValue({ data: { ...base, payload: { ...base.payload, sanitizer: 'Peracetic acid' } }, error: null });
    const { user, onChanged } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog', { name: 'Edit cleaning & sanitizing' })).toBeTruthy();
    await user.clear(screen.getByLabelText(/^Sanitizer used/));
    await user.type(screen.getByLabelText(/^Sanitizer used/), 'Peracetic acid');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' })));
  });
});

describe('RecordDetail: a draft', () => {
  const draft = { ...base, kind: 'note', source: 'web_upload', status: 'draft', confidence: null, payload: { text: 'Dry spell', category: 'observation' } };
  const buttons = () => screen.queryAllByRole('button').map((b) => b.textContent);
  const draftWithRevisions = () => records.listRevisions.mockResolvedValue({ data: [], error: null });

  it('gives an owner Approve, Delete and Edit, and not the half-steps in between', async () => {
    draftWithRevisions();
    setup(draft);
    expect(buttons()).toEqual(expect.arrayContaining(['Approve', 'Delete', 'Edit', 'Close']));
    for (const name of ['Mark ready for review', 'Ask for details', 'Void', 'Reject']) expect(buttons()).not.toContain(name);
    await screen.findByText('No history yet.');
  });

  it('approves a draft in one click, going through review as the database requires', async () => {
    draftWithRevisions();
    records.advanceRecord.mockResolvedValue({ data: { ...draft, status: 'approved' }, error: null });
    const { user, onChanged } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['pending_review', 'approved']));
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    await screen.findByText('No history yet.');
  });

  it('cannot approve a draft that is missing something, and says what', async () => {
    draftWithRevisions();
    setup({ ...draft, missing_fields: ['text'], payload: { category: 'observation' } });
    expect(screen.getByRole('button', { name: 'Approve' }).disabled).toBe(true);
    expect(screen.getByText(/Missing:/).textContent).toMatch(/Note/);
    await screen.findByText('No history yet.');
  });

  it('asks before deleting, in words that say it leaves the logs, and does nothing if declined', async () => {
    draftWithRevisions();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    records.advanceRecord.mockResolvedValue({ data: { ...draft, status: 'voided' }, error: null });
    const { user, onChanged, onClose } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Delete this entry\? It leaves your logs/));
    expect(records.advanceRecord).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['voided']));
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'voided' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await screen.findByText('No history yet.');
  });

  it('stays open, with the reason, when a delete is refused', async () => {
    draftWithRevisions();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    records.advanceRecord.mockResolvedValue({ data: null, error: { code: 'forbidden' } });
    const { user, onClose } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after voiding an approved record, since it leaves the log', async () => {
    draftWithRevisions();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    records.advanceRecord.mockResolvedValue({ data: { ...draft, status: 'voided' }, error: null });
    const { user, onClose } = setup({ ...draft, status: 'approved' });
    await user.click(screen.getByRole('button', { name: 'Void' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the word Void for a record that was already approved, and says Delete only before then', async () => {
    draftWithRevisions();
    setup({ ...draft, status: 'approved' });
    expect(buttons()).toContain('Void');
    expect(buttons()).not.toContain('Delete');
    await screen.findByText('No history yet.');
  });

  it('shows how far it got and says why, when a later step is refused', async () => {
    draftWithRevisions();
    records.advanceRecord.mockResolvedValue({ data: { ...draft, status: 'pending_review' }, error: { code: 'incomplete' } });
    const { user, onChanged } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/incomplete|missing|fill/i);
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_review' }));
    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0);
  });

  it('leaves the record alone and says why when the very first step is refused', async () => {
    draftWithRevisions();
    records.advanceRecord.mockResolvedValue({ data: null, error: { code: 'forbidden' } });
    const { user, onChanged } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });

  it('says Eliminar in Spanish', async () => {
    draftWithRevisions();
    setup(draft, {}, 'es');
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeTruthy();
    await screen.findByText('Aún no hay historial.');
  });

  it('lets an owner finish a draft from the edit form: save the changes, then approve', async () => {
    draftWithRevisions();
    records.updateRecord.mockResolvedValue({ data: { ...draft, payload: { ...draft.payload, text: 'Dry spell, no rain for 3 weeks' } }, error: null });
    records.advanceRecord.mockResolvedValue({ data: { ...draft, status: 'approved' }, error: null });
    const { user, onChanged } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog', { name: 'Edit note' });
    await user.type(screen.getByLabelText(/^Note/), ', no rain for 3 weeks');
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['pending_review', 'approved']));
    expect(records.updateRecord).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onChanged).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'approved' })));
  });

  it('still lets an owner save an edit to a draft without approving it', async () => {
    draftWithRevisions();
    records.updateRecord.mockResolvedValue({ data: draft, error: null });
    const { user, onChanged } = setup(draft);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(records.advanceRecord).not.toHaveBeenCalled();
  });

  it('lets crew send their own draft for review from the edit form, and nothing further', async () => {
    draftWithRevisions();
    records.updateRecord.mockResolvedValue({ data: draft, error: null });
    records.advanceRecord.mockResolvedValue({ data: { ...draft, status: 'pending_review' }, error: null });
    const { user } = setup(draft, { role: 'crew', userId: 'crew-1' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(records.advanceRecord).toHaveBeenCalledWith('r1', ['pending_review']));
  });

  it('does not offer to approve from the edit form when the record is already approved', async () => {
    draftWithRevisions();
    setup({ ...draft, status: 'approved' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
  });
});

describe('RecordDetail: a flood and the water it may have reached', () => {
  const flood = { ...base, id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-06-10', created_at: '2026-06-10T15:00:00Z', source: 'manual', confidence: null, payload: { event_type: 'flood', field: 'A1', crop_contact: 'no' } };
  const assessment = (source, fields, date) => ({ id: `a-${source}`, kind: 'water_assessment', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, source_type: 'enclosed_groundwater', fields_served: fields, application_method: 'drip', ...Object.fromEntries(['source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern', 'testing_concern'].map((k) => [k, 'low'])), conclusion: 'no_mitigation' } });
  const farmHas = (list) => listRecordsForReport.mockImplementation(async ({ kinds }) => ({ data: { records: list.filter((r) => kinds.includes(r.kind)), truncated: false }, error: null }));
  const panel = () => screen.getByRole('region', { name: 'Water this flood may have reached' });

  it('lists the water sources that water the flooded field, and says which need a new assessment', async () => {
    farmHas([assessment('Well 1', 'A1, A2', '2026-03-01'), assessment('Canal', 'A1', '2026-06-20'), assessment('Pond', 'C1', '2026-03-01'), flood]);
    setup(flood);
    expect(await within(await screen.findByRole('region', { name: 'Water this flood may have reached' })).findByText('Well 1')).toBeTruthy();
    const items = within(panel()).getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Well 1Needs a new assessmentAssess Well 1 again', 'CanalAssessed again on 2026-06-20']);
    await screen.findByText('Created');
  });

  it('starts the new assessment from the source’s last answers, right there, and reads again once it is saved', async () => {
    farmHas([assessment('Well 1', 'A1, A2', '2026-03-01'), flood]);
    records.createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onChanged } = setup(flood);
    await user.click(await screen.findByRole('button', { name: 'Assess Well 1 again' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add water assessment' });
    expect(within(dialog).getByLabelText(/^Water source or system/).value).toBe('Well 1');
    expect(within(dialog).getByLabelText(/^Fields this water is used on/).value).toBe('A1, A2');
    for (const label of [/^The source and how/, /^Animals, manure/, /^How the water is applied, and the time/, /^The crop/, /^The weather/, /^Water test results/]) {
      expect(within(dialog).getByLabelText(label).value).toBe('low');
    }
    await user.selectOptions(within(dialog).getByLabelText(/^What you decided/), 'no_mitigation');
    const reads = listRecordsForReport.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(records.createRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'water_assessment' })));
    expect(await screen.findByRole('dialog', { name: 'Weather event' })).toBeTruthy();
    await waitFor(() => expect(listRecordsForReport.mock.calls.length).toBeGreaterThan(reads));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('says so when no assessed water source is tied to the flood', async () => {
    farmHas([assessment('Pond', 'C1', '2026-03-01'), flood]);
    setup(flood);
    expect(await screen.findByText(/No assessed water source is tied to this flood/)).toBeTruthy();
    await screen.findByText('Created');
  });

  it('finds the source the flood names', async () => {
    farmHas([assessment('Pond', 'C1', '2026-03-01')]);
    setup({ ...flood, payload: { ...flood.payload, water_source: 'pond' } });
    expect(await screen.findByText('Pond')).toBeTruthy();
    await screen.findByText('Created');
  });

  it('says so when the water assessments could not be read, rather than saying none are tied', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    setup(flood);
    expect(await screen.findByText('The water assessments could not be checked right now.')).toBeTruthy();
    expect(screen.queryByText(/No assessed water source/)).toBeNull();
    await screen.findByText('Created');
  });

  it('does not show it for other weather, or for other records, and reads nothing for them', async () => {
    setup({ ...flood, payload: { ...flood.payload, event_type: 'hail' } });
    await screen.findByText('Created');
    expect(screen.queryByRole('region', { name: 'Water this flood may have reached' })).toBeNull();
    cleanup();
    setup(base);
    await screen.findByText('Created');
    expect(screen.queryByRole('region', { name: 'Water this flood may have reached' })).toBeNull();
    expect(listRecordsForReport).not.toHaveBeenCalledWith(expect.objectContaining({ kinds: ['weather_event', 'water_assessment'] }));
  });

  it('speaks Spanish', async () => {
    farmHas([assessment('Pozo 1', 'A1', '2026-03-01'), flood]);
    setup(flood, {}, 'es');
    expect(await screen.findByRole('region', { name: 'Agua que esta inundación pudo alcanzar' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Evaluar de nuevo Pozo 1' })).toBeTruthy();
    await screen.findByText('Creado');
  });
});

describe('RecordDetail: source files', () => {
  const withFiles = { ...base, attachments: [{ path: 'farm-1/h/0.jpg', media_type: 'image/jpeg', bytes: 10 }, { path: 'farm-1/h/1.pdf', media_type: 'application/pdf', bytes: 20 }] };

  it('shows nothing for a record with no stored files', () => {
    setup(base);
    expect(screen.queryByText('Source file')).toBeNull();
  });

  it('opens a stored file through a freshly signed link', async () => {
    db.getAttachmentUrl.mockResolvedValue('https://signed/1');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { user } = setup(withFiles);
    expect(screen.getByText('Source file')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'View file 2' }));
    expect(db.getAttachmentUrl).toHaveBeenCalledWith(expect.objectContaining({ path: 'farm-1/h/1.pdf' }));
    expect(open).toHaveBeenCalledWith('https://signed/1', '_blank', 'noopener,noreferrer');
  });

  it('says so when the link cannot be made, and opens nothing', async () => {
    db.getAttachmentUrl.mockResolvedValue(null);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { user } = setup(withFiles);
    await user.click(screen.getByRole('button', { name: 'View file 1' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not open the file/);
    expect(open).not.toHaveBeenCalled();
  });

  it('is available in Spanish', () => {
    setup(withFiles, {}, 'es');
    expect(screen.getByText('Archivo de origen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver archivo 1' })).toBeTruthy();
  });
});

describe('RecordDetail: the farm’s field list', () => {
  const withList = (fields, props = {}) => {
    const user = userEvent.setup();
    renderWithLang(
      <FarmFieldsContext.Provider value={{ status: 'ready', fields, reload: () => {} }}>
        <RecordDetail record={base} role="owner" userId="owner-1" farm={{ id: 'farm-1' }} onClose={() => {}} onChanged={() => {}} {...props} />
      </FarmFieldsContext.Provider>,
    );
    return { user };
  };
  const list = (...names) => names.map((name) => ({ id: `id-${name}`, name, is_active: true }));

  it('says the record’s field is not in the list, right under the field, when it is not', async () => {
    withList(list('A1', 'C2'));
    const row = screen.getByText('Field / area').closest('[data-testid="detail-row"]');
    expect(within(row).getByText('“B4” is not in your field list.')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Add to field list' })).toBeTruthy();
    await screen.findByText('Approved');
  });

  it('says nothing when the field is in the list, whatever its capital letters', async () => {
    withList(list('b4'));
    expect(screen.queryByText(/is not in your field list/)).toBeNull();
    await screen.findByText('Approved');
  });

  it('says nothing for a farm that has no field list yet', async () => {
    withList([]);
    expect(screen.queryByText(/is not in your field list/)).toBeNull();
    await screen.findByText('Approved');
  });

  it('does not offer crew the button', async () => {
    withList(list('A1'), { role: 'crew' });
    expect(screen.getByText('“B4” is not in your field list.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to field list' })).toBeNull();
    await screen.findByText('Approved');
  });

  it('puts no hint on other fields, or on a record with no field', async () => {
    withList(list('A1'), { record: { ...base, kind: 'sanitizer_purchase', payload: { product: 'Compost', supplier: 'Acme' } } });
    expect(screen.queryByText(/is not in your field list/)).toBeNull();
    await screen.findByText('Approved');
  });
});
