import { describe, it, expect, vi } from 'vitest';
import { runCapture, PipelineError } from './capturePipeline.js';
import { captureHashOf } from './captureRows.js';

const logger = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() });
const FARM = '11111111-1111-4111-8111-111111111111';

const cleaning = (extra = {}) => ({ kind: 'sanitation_log', record_date: '2026-10-11', payload: { item: 'Harvest bins', method: 'clean_sanitize', sanitizer: 'Peracetic acid', ppm: 150, ...extra }, confidence: 0.9, missing: [], dropped: [], complete: true });
const illness = () => ({ kind: 'illness_injury', record_date: '2026-10-11', payload: { person: 'Ana', type: 'illness', description: 'Vomiting', removed_from_contact: 'yes' }, confidence: 0.9, missing: [], dropped: [], complete: true });
const answer = (proposals, extra = {}) => ({ proposals, message: '', usage: { input_tokens: 1, output_tokens: 1 }, refused: false, truncated: false, skippedProposals: 0, tooMany: false, ...extra });
const label = (min, max) => ({ id: 'l1', kind: 'sanitizer_label', status: 'approved', record_date: '2026-03-01', payload: { product: 'Peracetic acid', ppm_min: min, ppm_max: max } });

function setup({ proposals = [cleaning()], role = 'manager', labels = [label(100, 200)], ports = {} } = {}) {
  const inserted = [];
  const portSet = {
    findCapture: vi.fn(async () => []),
    uploadAttachments: vi.fn(async ({ attachments }) => attachments.map((a, i) => ({ path: `p/${i}`, media_type: a.source.media_type, bytes: 1 }))),
    insertRecords: vi.fn(async (rows) => { inserted.push(...rows); return rows.map((r, i) => ({ ...r, id: `rec-${i}`, version: 1 })); }),
    listSanitizerLabels: vi.fn(async () => labels),
    ...ports,
  };
  const extract = vi.fn(async () => answer(proposals));
  const run = (extra = {}) => runCapture({ ports: portSet, extract, anthropic: {}, config: { agent: {} }, userId: 'u1', farmId: FARM, role, text: 'cleaned the bins', attachments: [], day: '2026-10-13', logger: logger(), ...extra });
  return { run, portSet, extract, inserted };
}

describe('runCapture: what is filed', () => {
  it('files every proposal for review, from the signed-in person and farm, never approved', async () => {
    const { run, inserted } = setup({ proposals: [cleaning(), cleaning({ item: 'Truck bed' })] });
    const result = await run();
    expect(result.outcome).toBe('saved');
    expect(inserted).toHaveLength(2);
    for (const row of inserted) expect(row).toMatchObject({ farm_id: FARM, created_by: 'u1', status: 'pending_review', source: 'web_upload' });
    expect(inserted.map((r) => r.source_ref.endsWith('#0') || r.source_ref.endsWith('#1'))).toEqual([true, true]);
  });

  it('names the way in, so Telegram records say Telegram', async () => {
    const { run, inserted } = setup();
    await run({ source: 'telegram' });
    expect(inserted[0].source).toBe('telegram');
  });

  it('files an incomplete proposal as needing details', async () => {
    const { run, inserted } = setup({ proposals: [{ ...cleaning(), complete: false, missing: ['ppm'] }] });
    await run();
    expect(inserted[0]).toMatchObject({ status: 'needs_info', missing_fields: ['ppm'] });
  });
});

describe('runCapture: health information stays with owners and managers', () => {
  it.each(['owner', 'manager'])('files an illness report from a %s', async (role) => {
    const { run, inserted } = setup({ proposals: [illness()], role });
    const result = await run();
    expect(result.outcome).toBe('saved');
    expect(inserted[0].kind).toBe('illness_injury');
  });

  it('does not file an illness report from crew, and says one was skipped', async () => {
    const { run, inserted, portSet } = setup({ proposals: [illness()], role: 'crew' });
    const result = await run();
    expect(result).toMatchObject({ outcome: 'empty', flags: { restrictedSkipped: 1 } });
    expect(inserted).toEqual([]);
    expect(portSet.insertRecords).not.toHaveBeenCalled();
  });

  it('does not file it for a person with no known role, either', async () => {
    const { run, inserted } = setup({ proposals: [illness()], role: null });
    expect((await run()).outcome).toBe('empty');
    expect(inserted).toEqual([]);
  });

  it('files the ordinary records of a message and skips only the illness report, for crew', async () => {
    const { run, inserted } = setup({ proposals: [cleaning(), illness()], role: 'crew' });
    const result = await run();
    expect(result.outcome).toBe('saved');
    expect(result.flags.restrictedSkipped).toBe(1);
    expect(inserted.map((r) => r.kind)).toEqual(['sanitation_log']);
  });

  it('does not repeat the model’s own words when something was held back', async () => {
    const extract = vi.fn(async () => answer([illness()], { message: 'I filed an illness report for Ana.' }));
    const { run } = setup({ role: 'crew' });
    const result = await run({ extract });
    expect(result.message).toBe('');
  });

  it('keeps a crew member’s photo in the restricted folder when an illness report in it was held back, so the records filed from it do not show it to everyone', async () => {
    const photo = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } };
    const { run, portSet } = setup({ proposals: [illness(), cleaning()], role: 'crew' });
    await run({ attachments: [photo] });
    expect(portSet.uploadAttachments).toHaveBeenCalledWith(expect.objectContaining({ restricted: true }));
  });

  it('keeps photos that go with an illness report in the restricted folder, and other photos in the ordinary one', async () => {
    const photo = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } };
    const sick = setup({ proposals: [illness()], role: 'manager' });
    await sick.run({ attachments: [photo] });
    expect(sick.portSet.uploadAttachments).toHaveBeenCalledWith(expect.objectContaining({ restricted: true }));
    const plain = setup({ proposals: [cleaning()], role: 'manager' });
    await plain.run({ attachments: [photo] });
    expect(plain.portSet.uploadAttachments).toHaveBeenCalledWith(expect.objectContaining({ restricted: false }));
  });
});

describe('runCapture: a cleaning log’s result comes from the sanitizer label', () => {
  it('writes pass when the reading is inside the label’s range', async () => {
    const { run, inserted } = setup({ proposals: [cleaning({ ppm: 150 })] });
    await run();
    expect(inserted[0].payload.check_result).toBe('pass');
  });

  it('writes fail when it is outside, whatever the model wrote', async () => {
    const { run, inserted } = setup({ proposals: [cleaning({ ppm: 400, check_result: 'pass' })] });
    await run();
    expect(inserted[0].payload.check_result).toBe('fail');
  });

  it('uses the label in force on the day of the log', async () => {
    const { run, inserted } = setup({ proposals: [{ ...cleaning({ ppm: 150 }), record_date: '2026-02-01' }], labels: [label(10, 20)] });
    await run();
    expect(inserted[0].payload.check_result).toBe('fail'); // only label found (written later) still applies: it is the only one
  });

  it('leaves the result out when there is no label for the sanitizer', async () => {
    const { run, inserted } = setup({ proposals: [cleaning({ sanitizer: 'Vinegar' })] });
    await run();
    expect(inserted[0].payload).not.toHaveProperty('check_result');
  });

  it('does not look at labels for records that are not cleaning logs', async () => {
    const harvest = { kind: 'harvest', record_date: '2026-10-11', payload: { crop: 'Lettuce', field: 'A1', quantity: 5, unit: 'lb' }, confidence: 0.9, missing: [], dropped: [], complete: true };
    const { run, portSet } = setup({ proposals: [harvest] });
    await run();
    expect(portSet.listSanitizerLabels).not.toHaveBeenCalled();
  });

  it('still files the log, without a result, when the labels cannot be read, and says so in the log', async () => {
    const log = logger();
    const { run, inserted } = setup({ ports: { listSanitizerLabels: vi.fn(async () => { throw new Error('db down'); }) } });
    const result = await run({ logger: log });
    expect(result.outcome).toBe('saved');
    expect(inserted[0].payload).not.toHaveProperty('check_result');
    expect(log.warn).toHaveBeenCalled();
  });

  it('drops a result the model wrote when there is no label to decide it', async () => {
    const { run, inserted } = setup({ proposals: [cleaning({ sanitizer: 'Vinegar', ppm: 900, check_result: 'pass' })] });
    await run();
    expect(inserted[0].payload).not.toHaveProperty('check_result');
  });

  it('drops a result the model wrote when the labels cannot be read, or the caller gives no way to read them', async () => {
    const unreadable = setup({ proposals: [cleaning({ ppm: 900, check_result: 'pass' })], ports: { listSanitizerLabels: vi.fn(async () => { throw new Error('db down'); }) } });
    await unreadable.run();
    expect(unreadable.inserted[0].payload).not.toHaveProperty('check_result');
    const none = setup({ proposals: [cleaning({ ppm: 900, check_result: 'pass' })], ports: { listSanitizerLabels: undefined } });
    await none.run();
    expect(none.inserted[0].payload).not.toHaveProperty('check_result');
  });

  it('drops a result the model wrote on a cleaning-only step', async () => {
    const { run, inserted } = setup({ proposals: [cleaning({ method: 'clean_only', check_result: 'pass' })] });
    await run();
    expect(inserted[0].payload).not.toHaveProperty('check_result');
  });

  it('matches the product by its exact name, so a part of a name never borrows another product’s range', async () => {
    const { run, inserted } = setup({ proposals: [cleaning({ sanitizer: 'acid', ppm: 150 })] });
    await run();
    expect(inserted[0].payload).not.toHaveProperty('check_result');
  });

  it('files the log when the caller gives no way to read labels', async () => {
    const { run, inserted } = setup({ ports: { listSanitizerLabels: undefined } });
    await run();
    expect(inserted).toHaveLength(1);
  });
});

describe('runCapture: repeats and failures', () => {
  it('answers a repeat from what was already filed, without a model call', async () => {
    const hash = captureHashOf({ text: 'cleaned the bins', attachments: [], userId: 'u1', day: '2026-10-13', attempt: 0 });
    const existing = [{ id: 'old', status: 'pending_review', source_ref: `${hash}#0` }];
    const { run, extract } = setup({ ports: { findCapture: vi.fn(async () => existing) } });
    expect(await run()).toEqual({ outcome: 'duplicate', rows: existing });
    expect(extract).not.toHaveBeenCalled();
  });

  it('says which stage failed', async () => {
    const lookup = setup({ ports: { findCapture: vi.fn(async () => { throw new Error('x'); }) } });
    await expect(lookup.run()).rejects.toMatchObject({ name: 'PipelineError', stage: 'lookup' });
    const extractFails = setup();
    await expect(extractFails.run({ extract: vi.fn(async () => { throw new Error('model down'); }) })).rejects.toMatchObject({ stage: 'extract' });
    const save = setup({ ports: { insertRecords: vi.fn(async () => { throw new Error('db down'); }) } });
    await expect(save.run()).rejects.toBeInstanceOf(PipelineError);
  });

  it('files the records but warns, when the original photo cannot be kept', async () => {
    const photo = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } };
    const { run, inserted } = setup({ ports: { uploadAttachments: vi.fn(async () => { throw new Error('storage down'); }) } });
    const result = await run({ attachments: [photo] });
    expect(result.outcome).toBe('saved');
    expect(result.warnings).toEqual(['files_not_saved']);
    expect(inserted).toHaveLength(1);
  });
});
