// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';
import { DEFAULT_SAVED_VIEWS } from '../../domain/records/savedViews.js';

vi.mock('../../lib/records.js', () => ({
  listRecords: vi.fn(), listSavedViewRecords: vi.fn(), listRevisions: vi.fn(), createRecord: vi.fn(), updateRecord: vi.fn(), setRecordStatus: vi.fn(),
}));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn(), listSavedViewRecordsForReport: vi.fn() }));
vi.mock('../../lib/fields.js', () => ({ listFields: vi.fn(), createField: vi.fn(), updateField: vi.fn(), setFieldActive: vi.fn(), deleteField: vi.fn(), addFieldsByName: vi.fn() }));
vi.mock('../../lib/reportCsv.js', () => ({ downloadCsv: vi.fn() }));
vi.mock('../../lib/reportDocx.js', () => ({ downloadReportDocx: vi.fn() }));
const records = await import('../../lib/records.js');
const reportData = await import('../../lib/reportData.js');
const fieldsLib = await import('../../lib/fields.js');
const { default: RecordsPage } = await import('./RecordsPage.jsx');

const FARM = { id: 'farm-1', name: 'Sunny', farm_code: 'F-ABC234', season_start_month: 4, season_start_day: 1 };
const views = DEFAULT_SAVED_VIEWS.map((v, i) => ({ id: `view-${i}`, slug: v.slug, name: v.name.en, pinned: true, position: i + 1, filter: v.filter }));
const purchase = { id: 'r1', kind: 'sanitizer_purchase', status: 'approved', record_date: '2026-10-01', source: 'import', payload: { product: 'Compost', supplier: 'Acme' }, missing_fields: [], created_by: 'u1' };
const pendingPurchase = { ...purchase, id: 'r2', status: 'pending_review', payload: { product: 'Kelp', supplier: 'Bobco' } };

const setup = (route, props = {}, lang = 'en') => {
  const handlers = { onNavigate: vi.fn(), onChanged: vi.fn(), onRetryFarm: vi.fn() };
  const user = userEvent.setup();
  renderWithLang(<RecordsPage route={route} farm={FARM} role="owner" userId="u1" savedViews={views} needsReviewCount={0} {...handlers} {...props} />, lang);
  return { user, ...handlers };
};

beforeEach(() => {
  localStorage.clear();
  Object.values(records).forEach((fn) => fn.mockReset());
  Object.values(reportData).forEach((fn) => fn.mockReset());
  Object.values(fieldsLib).forEach((fn) => fn.mockReset());
  fieldsLib.listFields.mockResolvedValue({ data: [{ id: 'f1', farm_id: 'farm-1', name: 'B2', area: null, area_unit: null, notes: null, is_active: true }], error: null });
  reportData.listRecordsForReport.mockResolvedValue({ data: { records: [purchase], truncated: false }, error: null });
  reportData.listSavedViewRecordsForReport.mockResolvedValue({ data: { records: [purchase], truncated: false }, error: null });
  records.listRecords.mockResolvedValue({ data: [purchase, pendingPurchase], error: null });
  records.listSavedViewRecords.mockResolvedValue({ data: [purchase], error: null });
  records.listRevisions.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);

describe('RecordsPage: farm not ready', () => {
  it('explains that the farm could not be found and offers a retry', async () => {
    const { user, onRetryFarm } = setup({ type: 'overview' }, { farm: null });
    expect(screen.getByText('Farm records are not ready yet')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryFarm).toHaveBeenCalled();
    expect(records.listRecords).not.toHaveBeenCalled();
  });
});

describe('RecordsPage: overview', () => {
  it('shows the title, the review callout and a button to the queue', async () => {
    const { user, onNavigate } = setup({ type: 'overview' }, { needsReviewCount: 3 });
    expect(screen.getByRole('heading', { name: 'Records' })).toBeTruthy();
    expect(screen.getByText('3 records are waiting for review')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open review queue' }));
    expect(onNavigate).toHaveBeenCalledWith('needsReview');
  });

  it('shows no callout when nothing is waiting', () => {
    setup({ type: 'overview' });
    expect(screen.queryByText(/waiting for review/)).toBeNull();
  });

  it('lets people start a new record of any kind', async () => {
    const { user } = setup({ type: 'overview' });
    await user.click(screen.getByRole('button', { name: 'Harvest & traceability' }));
    await user.click(screen.getByRole('button', { name: 'Add harvest' }));
    expect(await screen.findByRole('dialog', { name: 'Add harvest' })).toBeTruthy();
  });

  it('opens a log from the Records home', async () => {
    const { user, onNavigate } = setup({ type: 'overview' });
    await user.click(screen.getByRole('button', { name: 'Harvest & traceability' }));
    await user.click(screen.getByRole('button', { name: 'Harvest Log' }));
    expect(onNavigate).toHaveBeenCalledWith('log:harvest');
  });

  it('lists the saved views and opens one', async () => {
    const { user, onNavigate } = setup({ type: 'overview' });
    await user.click(screen.getByRole('button', { name: 'Saved views' }));
    await user.click(screen.getByRole('button', { name: 'Sanitizer checks out of range' }));
    expect(onNavigate).toHaveBeenCalledWith('view:view-0');
  });
});

describe('RecordsPage: fields', () => {
  it('opens the Fields page, with the farm’s fields', async () => {
    setup({ type: 'fields' });
    expect(screen.getByRole('heading', { name: 'Fields' })).toBeTruthy();
    expect(await screen.findByRole('row', { name: /^B2\b/ })).toBeTruthy();
    expect(fieldsLib.listFields).toHaveBeenCalledWith('farm-1');
  });

  it('lets an owner or manager add fields, and not crew', async () => {
    setup({ type: 'fields' }, { role: 'manager' });
    expect(await screen.findByRole('button', { name: 'Add field' })).toBeTruthy();
    cleanup();
    setup({ type: 'fields' }, { role: 'crew' });
    await screen.findByRole('row', { name: /^B2\b/ });
    expect(screen.queryByRole('button', { name: 'Add field' })).toBeNull();
  });

  it('reads the fields once for the whole records area, not once per screen', async () => {
    const { user } = setup({ type: 'overview' });
    await user.click(screen.getByRole('button', { name: 'Harvest & traceability' }));
    await user.click(screen.getByRole('button', { name: 'Add harvest' }));
    await screen.findByRole('dialog', { name: 'Add harvest' });
    expect(fieldsLib.listFields).toHaveBeenCalledTimes(1);
  });

  it('does not read fields while there is no farm', () => {
    setup({ type: 'fields' }, { farm: null });
    expect(fieldsLib.listFields).not.toHaveBeenCalled();
  });
});

describe('RecordsPage: reports', () => {
  it('opens the Reports page', () => {
    setup({ type: 'reports' });
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create report' })).toBeTruthy();
  });

  it('builds a report for the farm, with the operation’s details and the count of records waiting for review', async () => {
    const { user } = setup({ type: 'reports' }, { operation: { operationName: 'Palo Verde Produce' }, needsReviewCount: 5 });
    await user.click(screen.getByRole('button', { name: 'Create report' }));
    expect(await screen.findByText('1 record in this report')).toBeTruthy();
    expect(reportData.listRecordsForReport).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', includeUnapproved: false }));
    expect(document.querySelector('.report-doc').textContent).toContain('Palo Verde Produce');
    expect(screen.getByText('Your farm has 5 records waiting for review. Records waiting for review are not included in this report.')).toBeTruthy();
  });

  it('links to the change history, which is no longer a menu item of its own', async () => {
    const { user, onNavigate } = setup({ type: 'reports' });
    await user.click(screen.getByRole('button', { name: 'See every change made to your records' }));
    expect(onNavigate).toHaveBeenCalledWith('changeHistory');
  });

  it('hands the operation’s details and the review count down to a log’s download', async () => {
    const { user } = setup({ type: 'log', kind: 'sanitizer_purchase' }, { operation: { operationName: 'Palo Verde Produce' }, needsReviewCount: 2 });
    await user.click(await screen.findByRole('button', { name: 'Download' }));
    expect(await screen.findByText('1 record in this report')).toBeTruthy();
    expect(document.querySelector('.report-doc').textContent).toContain('Palo Verde Produce');
    expect(screen.getByText('Your farm has 2 records waiting for review. Records waiting for review are not included in this report.')).toBeTruthy();
  });

  it('uses the farm profile’s details for everyone, since the whole team shares the farm profile', async () => {
    for (const role of ['owner', 'manager', 'crew']) {
      const { user } = setup({ type: 'log', kind: 'sanitizer_purchase' }, { role, operation: { operationName: 'Palo Verde Produce', ownerName: 'Cuong Nguyen', auditor: 'PrimusGFS' } });
      await user.click(await screen.findByRole('button', { name: 'Download' }));
      await screen.findByText('1 record in this report');
      const report = document.querySelector('.report-doc').textContent;
      expect(report, role).toContain('Palo Verde Produce');
      expect(report, role).toContain('Cuong Nguyen');
      expect(report, role).toContain('PrimusGFS');
      cleanup();
    }
  });

  it('names the farm when there are no farm profile details', async () => {
    const { user } = setup({ type: 'reports' }, { role: 'manager' });
    await user.click(screen.getByRole('button', { name: 'Create report' }));
    await screen.findByText('1 record in this report');
    expect(document.querySelector('.report-doc').textContent).toContain('Sunny');
  });

  it('hands them down to a saved view’s download too', async () => {
    const { user } = setup({ type: 'view', viewId: 'view-1' }, { operation: { operationName: 'Palo Verde Produce' }, needsReviewCount: 2 });
    await user.click(await screen.findByRole('button', { name: 'Download' }));
    expect(await screen.findByText('1 record in this report')).toBeTruthy();
    expect(document.querySelector('.report-doc').textContent).toContain('Palo Verde Produce');
    expect(screen.getByText('Your farm has 2 records waiting for review. Records waiting for review are not included in this report.')).toBeTruthy();
  });
});

describe('RecordsPage: a log crew may not see', () => {
  it('says only owners and managers can see illness and injury reports, and reads nothing', () => {
    setup({ type: 'log', kind: 'illness_injury' }, { role: 'crew' });
    expect(screen.getByText('Only owners and managers can see these records.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add/ })).toBeNull();
    expect(records.listRecords).not.toHaveBeenCalled();
  });

  it('opens it for a manager', async () => {
    setup({ type: 'log', kind: 'illness_injury' }, { role: 'manager' });
    expect(await screen.findByRole('heading', { name: 'Illness & Injury Reports' })).toBeTruthy();
  });
});

describe('RecordsPage: a log', () => {
  const route = { type: 'log', kind: 'sanitizer_purchase' };

  it('lists the records of that kind for the farm', async () => {
    setup(route);
    expect(await screen.findByText('Compost · Acme')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sanitizer Purchases' })).toBeTruthy();
    expect(records.listRecords).toHaveBeenCalledWith({ farmId: 'farm-1', kind: 'sanitizer_purchase' });
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Approved')).toBeTruthy(); // the badge, not the filter option of the same name
    expect(table.getAllByText('Imported')).toHaveLength(2); // both fixture rows came from the receipts import
  });

  it('filters by status', async () => {
    const { user } = setup(route);
    await screen.findByText('Kelp · Bobco');
    await user.selectOptions(screen.getByLabelText('Show'), 'approved');
    expect(screen.queryByText('Kelp · Bobco')).toBeNull();
    expect(screen.getByText('Compost · Acme')).toBeTruthy();
  });

  it('adds a record through the form and shows it without reloading', async () => {
    const created = { ...purchase, id: 'r3', status: 'approved', payload: { product: 'Worm castings', supplier: 'Cobalt' } };
    records.createRecord.mockResolvedValue({ data: created, error: null });
    const { user, onChanged } = setup(route);
    await screen.findByText('Compost · Acme');

    await user.click(screen.getByRole('button', { name: 'Add sanitizer purchase' }));
    await user.type(await screen.findByLabelText(/^Supplier/), 'Cobalt');
    await user.type(screen.getByLabelText(/^Product(?! lot)/), 'Worm castings');
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));

    expect(await screen.findByText('Worm castings · Cobalt')).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a record’s details when it is clicked', async () => {
    const { user } = setup(route);
    await user.click(await screen.findByText('Compost · Acme'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('shows an empty state and a load error', async () => {
    records.listRecords.mockResolvedValueOnce({ data: [], error: null });
    setup(route);
    expect(await screen.findByText('Nothing here yet.')).toBeTruthy();
    cleanup();
    records.listRecords.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    setup(route);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not load records/);
  });

  it('lets crew add a record for review but never approve it', async () => {
    const { user } = setup(route, { role: 'crew' });
    await user.click(await screen.findByRole('button', { name: 'Add sanitizer purchase' }));
    expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
  });

  it('is available in Spanish', async () => {
    setup(route, {}, 'es');
    expect(await screen.findByRole('heading', { name: 'Compras de Desinfectantes' })).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Aprobado')).toBeTruthy();
  });
});

describe('RecordsPage: a saved view', () => {
  it('runs the view for this farm and shows its results under the view’s name', async () => {
    setup({ type: 'view', viewId: 'view-0' });
    expect(await screen.findByText('Compost · Acme')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sanitizer checks out of range' })).toBeTruthy();
    const [view, ctx] = records.listSavedViewRecords.mock.calls[0];
    expect(view.id).toBe('view-0');
    expect(ctx.farm).toMatchObject({ id: 'farm-1', season_start_month: 4, season_start_day: 1 });
    expect(ctx.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('says so when the view no longer exists', () => {
    setup({ type: 'view', viewId: 'gone' });
    expect(screen.getByText('This view no longer exists.')).toBeTruthy();
    expect(records.listSavedViewRecords).not.toHaveBeenCalled();
  });

  it('does not claim the view is missing while the farm’s views are still loading', () => {
    setup({ type: 'view', viewId: 'view-0' }, { savedViews: [], metaReady: false });
    expect(screen.queryByText('This view no longer exists.')).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    records.listSavedViewRecords.mockResolvedValue({ data: [], error: null });
    setup({ type: 'view', viewId: 'view-1' });
    expect(await screen.findByText('No records match this view.')).toBeTruthy();
  });

  it('shows the view’s name in Spanish for a default view', async () => {
    setup({ type: 'view', viewId: 'view-0' }, {}, 'es');
    expect(await screen.findByRole('heading', { name: 'Desinfectante fuera de rango' })).toBeTruthy();
  });
});

describe('RecordsPage: change history', () => {
  it('lists recent changes for the farm, newest first, with what changed', async () => {
    records.listRevisions.mockResolvedValue({ data: [
      { id: 2, record_id: 'r1', version: 2, change_type: 'status:approved', changed_at: '2026-10-02T09:00:00Z', after: { kind: 'sanitizer_purchase', payload: { product: 'Compost', supplier: 'Acme' } } },
      { id: 1, record_id: 'r1', version: 1, change_type: 'created', changed_at: '2026-10-01T12:00:00Z', after: { kind: 'sanitizer_purchase', payload: { product: 'Compost', supplier: 'Acme' } } },
    ], error: null });
    setup({ type: 'history' });
    expect(await screen.findByText('Approved')).toBeTruthy();
    expect(screen.getByText('Created')).toBeTruthy();
    expect(screen.getAllByText('Compost · Acme')).toHaveLength(2);
    expect(records.listRevisions).toHaveBeenCalledWith({ farmId: 'farm-1' });
  });

  it('shows an empty state', async () => {
    setup({ type: 'history' });
    expect(await screen.findByText('No changes recorded yet.')).toBeTruthy();
  });
});
