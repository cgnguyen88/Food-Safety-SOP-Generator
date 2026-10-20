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

const GROUPS = {
  Sanitation: ['Sanitation Log', 'Sanitizer Labels', 'Sanitizer Purchases'],
  'Field & environment': ['Weather Events', 'Wildlife Checks', 'Soil Amendments', 'Water Tests', 'Water Assessments'],
  People: ['Training Log', 'Visitor Log', 'Illness & Injury Reports'],
  'Harvest & traceability': ['Harvest Log', 'Packing & Cooling', 'Shipments', 'Corrective Actions'],
  Other: ['Notes'],
};
const header = (name) => screen.getByRole('button', { name });
const open = async (user, ...names) => {
  for (const name of names) if (header(name).getAttribute('aria-expanded') === 'false') await user.click(header(name));
};

beforeEach(() => {
  localStorage.clear();
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue({ data: { records: [], truncated: false }, error: null });
});
afterEach(cleanup);

describe('RecordsOverview', () => {
  it('opens with a photo banner that names the page', () => {
    setup();
    const container = document.body;
    expect(screen.getByRole('heading', { level: 1, name: 'Records' })).toBeTruthy();
    expect(container.querySelector('.photo-banner--slim')).toBeTruthy();
    expect(container.querySelector('.photo-banner').style.backgroundImage).toContain('/photos/produce.jpg');
  });

  it('puts the logs in groups named as written (not in capitals), and opens only the first group at first', () => {
    setup();
    for (const group of Object.keys(GROUPS)) expect(header(group).textContent.startsWith(group), group).toBe(true);
    expect(header('Sanitation').getAttribute('aria-expanded')).toBe('true');
    for (const group of Object.keys(GROUPS).slice(1)) expect(header(group).getAttribute('aria-expanded'), group).toBe('false');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(GROUPS.Sanitation);
  });

  it('lists every log of a group, one under the other, each with a button to add to it', async () => {
    const { user } = setup();
    await open(user, ...Object.keys(GROUPS));
    for (const [group, names] of Object.entries(GROUPS)) {
      const section = screen.getByRole('region', { name: group });
      const rows = within(section).getAllByRole('listitem');
      expect(rows.map((row) => within(row).getAllByRole('button')[0].textContent), group).toEqual(names);
      expect(within(section).getAllByRole('button', { name: /^Add / }), group).toHaveLength(names.length);
      expect(within(section).getByText(String(names.length))).toBeTruthy();
    }
  });

  it('opens a log when its name is chosen', async () => {
    const { user, onNavigate } = setup();
    await user.click(screen.getByRole('button', { name: 'Sanitation Log' }));
    expect(onNavigate).toHaveBeenCalledWith('log:sanitation_log');
  });

  it('starts a new record from the add button, with nothing filled in', async () => {
    const { user } = setup();
    await open(user, 'Harvest & traceability');
    await user.click(screen.getByRole('button', { name: 'Add harvest' }));
    expect(screen.getByRole('dialog', { name: 'Add harvest' })).toBeTruthy();
    expect(screen.getByLabelText(/^Field \/ block/).value).toBe('');
  });

  it('remembers which groups were open', async () => {
    const first = setup();
    await open(first.user, 'People');
    await first.user.click(header('Sanitation'));
    cleanup();
    setup();
    expect(header('People').getAttribute('aria-expanded')).toBe('true');
    expect(header('Sanitation').getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves illness and injury reports out for crew, and counts only what they can see', async () => {
    const { user } = setup({ role: 'crew' });
    await open(user, 'People');
    expect(screen.queryByRole('button', { name: 'Illness & Injury Reports' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Training Log' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'People' })).getByText('2')).toBeTruthy();
  });

  it('lists the saved views as a group of their own, closed at first, and opens one', async () => {
    const { user, onNavigate } = setup();
    expect(header('Saved views').getAttribute('aria-expanded')).toBe('false');
    expect(within(screen.getByRole('region', { name: 'Saved views' })).getByText(String(views.length))).toBeTruthy();
    await open(user, 'Saved views');
    await user.click(screen.getByRole('button', { name: 'Signs of animals this season' }));
    expect(onNavigate).toHaveBeenCalledWith('view:view-1');
  });

  it('shows no saved views group when there are none', () => {
    setup({ savedViews: [] });
    expect(screen.queryByRole('button', { name: 'Saved views' })).toBeNull();
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

  it('speaks Spanish', async () => {
    const { user } = setup({}, 'es');
    expect(screen.getByRole('heading', { level: 1, name: 'Registros' })).toBeTruthy();
    expect(header('Saneamiento')).toBeTruthy();
    await open(user, 'Cosecha y trazabilidad');
    expect(screen.getByRole('button', { name: 'Agregar cosecha' })).toBeTruthy();
  });
});
