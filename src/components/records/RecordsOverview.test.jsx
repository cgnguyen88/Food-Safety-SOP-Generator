// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';
import { DEFAULT_SAVED_VIEWS } from '../../domain/records/savedViews.js';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: RecordsOverview } = await import('./RecordsOverview.jsx');

const views = DEFAULT_SAVED_VIEWS.map((v, i) => ({ id: `view-${i}`, slug: v.slug, name: v.name.en, pinned: true, position: i + 1, filter: v.filter }));
const setup = (props = {}, lang = 'en') => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();
  renderWithLang(<RecordsOverview farm={{ id: 'farm-1' }} role="manager" savedViews={views} needsReviewCount={0} onNavigate={onNavigate} onChanged={() => {}} {...props} />, lang);
  return { user, onNavigate };
};

beforeEach(() => {
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue({ data: { records: [], truncated: false }, error: null });
});
afterEach(cleanup);

describe('RecordsOverview', () => {
  it('lists every log in its group, each with a button to add to it', () => {
    setup();
    const groups = {
      Sanitation: ['Sanitation Log', 'Sanitizer Labels', 'Sanitizer Purchases'],
      'Field & environment': ['Weather Events', 'Wildlife Checks', 'Soil Amendments', 'Water Tests'],
      People: ['Training Log', 'Visitor Log', 'Illness & Injury Reports'],
      'Harvest & traceability': ['Harvest Log', 'Packing & Cooling', 'Shipments', 'Corrective Actions'],
      Other: ['Notes'],
    };
    for (const [group, names] of Object.entries(groups)) {
      const section = screen.getByRole('region', { name: group });
      const logs = within(section).getAllByRole('button').filter((b) => !b.getAttribute('aria-label')).map((b) => b.textContent);
      expect(logs, group).toEqual(names);
      expect(within(section).getAllByRole('button', { name: /^Add / }), group).toHaveLength(names.length);
    }
  });

  it('opens a log when its name is chosen', async () => {
    const { user, onNavigate } = setup();
    await user.click(screen.getByRole('button', { name: 'Sanitation Log' }));
    expect(onNavigate).toHaveBeenCalledWith('log:sanitation_log');
  });

  it('starts a new record from the add button, with nothing filled in', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add harvest' }));
    expect(screen.getByRole('dialog', { name: 'Add harvest' })).toBeTruthy();
    expect(screen.getByLabelText(/^Field \/ block/).value).toBe('');
  });

  it('leaves illness and injury reports out for crew', () => {
    setup({ role: 'crew' });
    expect(screen.queryByRole('button', { name: 'Illness & Injury Reports' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Training Log' })).toBeTruthy();
  });

  it('lists the saved views and opens one', async () => {
    const { user, onNavigate } = setup();
    await user.click(screen.getByRole('button', { name: 'Signs of animals this season' }));
    expect(onNavigate).toHaveBeenCalledWith('view:view-1');
  });

  it('shows no saved views heading when there are none', () => {
    setup({ savedViews: [] });
    expect(screen.queryByRole('heading', { name: 'Saved views' })).toBeNull();
  });

  it('points to the review queue only when something is waiting', async () => {
    const { user, onNavigate } = setup({ needsReviewCount: 3 });
    expect(screen.getByText('3 records are waiting for review')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open review queue' }));
    expect(onNavigate).toHaveBeenCalledWith('needsReview');
    cleanup();
    setup();
    expect(screen.queryByText(/waiting for review/)).toBeNull();
  });

  it('speaks Spanish', () => {
    setup({}, 'es');
    expect(screen.getByRole('heading', { name: 'Registros por tipo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agregar cosecha' })).toBeTruthy();
  });
});
