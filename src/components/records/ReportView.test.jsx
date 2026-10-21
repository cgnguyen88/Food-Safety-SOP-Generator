// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { buildReport } from '../../domain/records/report.js';
import ReportView from './ReportView.jsx';

afterEach(cleanup);

let n = 0;
const rec = (kind, record_date, payload, extra = {}) =>
  ({ id: `r${++n}`, kind, status: 'approved', record_date, payload, source: 'manual', reviewed_at: '2026-06-02T10:00:00Z', created_at: `2026-06-01T10:00:${String(n % 60).padStart(2, '0')}Z`, ...extra });
const clean = (date, payload = {}) => rec('sanitation_log', date, { item: 'Harvest bins', field: 'B2', method: 'clean_sanitize', sanitizer: 'Chlorine', ppm: 150, ...payload });

const farm = { name: 'Palo Verde Farm', farm_code: 'PV-1234' };
const make = (records, extra = {}) => buildReport({ records, farm, operation: { operationName: 'Palo Verde Produce', auditor: 'PrimusGFS' }, lang: 'en', generatedOn: '2026-10-14', ...extra });

describe('ReportView', () => {
  it('shows the title, who the report is about, and each log with its records', () => {
    render(<ReportView report={make([clean('2026-07-01'), rec('harvest', '2026-08-01', { crop: 'Tomato', field: 'B2', quantity: 40, unit: 'lb' })])} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Food Safety Records Report' })).toBeTruthy();
    expect(screen.getByText('Palo Verde Produce')).toBeTruthy();
    expect(screen.getByText('PV-1234')).toBeTruthy();
    expect(screen.getByText('PrimusGFS')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Sanitation Log/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Harvest Log/ })).toBeTruthy();
    expect(screen.getByText('Chlorine')).toBeTruthy();
    expect(screen.getByText('40 lb')).toBeTruthy();
  });

  it('gives each table real column headings, so a screen reader can read it', () => {
    render(<ReportView report={make([clean('2026-07-01')])} />);
    const table = screen.getByRole('table', { name: /Sanitation Log/ });
    const headings = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headings).toEqual(['Date', 'Item or surface', 'Field / area', 'What was done', 'Sanitizer used', 'Concentration (ppm)', 'Approved']);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('keeps the records in order, oldest first', () => {
    render(<ReportView report={make([clean('2026-07-20'), clean('2026-07-01')])} />);
    const rows = within(screen.getByRole('table', { name: /Sanitation Log/ })).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.firstChild.textContent)).toEqual(['2026-07-01', '2026-07-20']);
  });

  it('shows a summary of how many records each log has', () => {
    render(<ReportView report={make([clean('2026-07-01'), clean('2026-07-02')])} />);
    const summary = screen.getByRole('table', { name: 'Summary' });
    expect(within(summary).getByText('2 records')).toBeTruthy();
  });

  it('can show only the first rows of each log, for a preview', () => {
    const records = Array.from({ length: 8 }, (_, i) => clean(`2026-07-0${i + 1}`));
    render(<ReportView report={make(records)} maxRows={3} />);
    expect(within(screen.getByRole('table', { name: /Sanitation Log/ })).getAllByRole('row')).toHaveLength(4);
  });

  it('shows everything when no limit is given', () => {
    const records = Array.from({ length: 8 }, (_, i) => clean(`2026-07-0${i + 1}`));
    render(<ReportView report={make(records)} />);
    expect(within(screen.getByRole('table', { name: /Sanitation Log/ })).getAllByRole('row')).toHaveLength(9);
  });

  it('shows text that looks like markup as plain text', () => {
    const { container } = render(<ReportView report={make([clean('2026-07-01', { notes: '<img src=x onerror=alert(1)>' })])} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
  });

  it('keeps a line break inside a note', () => {
    render(<ReportView report={make([clean('2026-07-01', { notes: 'first line\nsecond line' })])} />);
    const cell = screen.getByText(/first line/);
    expect(cell.textContent).toBe('first line\nsecond line');
    expect(getComputedStyle(cell).whiteSpace).toBe('pre-wrap');
  });

  it('says so when there is nothing to show', () => {
    render(<ReportView report={make([])} />);
    expect(screen.getByText('There are no records for this selection.')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Summary' })).toBeNull();
  });

  it('says so when the list was cut short', () => {
    render(<ReportView report={make([clean('2026-07-01')], { truncated: true })} />);
    expect(screen.getByText(/cut short/)).toBeTruthy();
  });

  it('ends with the lines to sign and the note that this is a copy, not a statement of compliance', () => {
    render(<ReportView report={make([clean('2026-07-01')])} />);
    for (const label of ['Prepared by', 'Signature', 'Date']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText(/not a statement of compliance/)).toBeTruthy();
  });

  it('reads in Spanish when the report is in Spanish', () => {
    render(<ReportView report={make([clean('2026-07-01')], { lang: 'es' })} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Informe de Registros de Inocuidad Alimentaria' })).toBeTruthy();
    expect(screen.getByText('Preparado por')).toBeTruthy();
  });

  it('marks the date cells, so a date is never split over two lines, and leaves other cells free to wrap', () => {
    render(<ReportView report={make([clean('2026-07-01', { notes: 'a long note' })])} />);
    const table = screen.getByRole('table', { name: /Sanitation Log/ });
    const cells = [...within(table).getAllByRole('row')[1].children];
    const headings = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    const dateCells = cells.filter((cell, i) => ['Date', 'Approved'].includes(headings[i]));
    expect(dateCells).toHaveLength(2);
    for (const cell of dateCells) expect(cell.className).toBe('report-date');
    for (const cell of cells.filter((c) => !dateCells.includes(c))) expect(cell.className).toBe('');
    expect(getComputedStyle(cells[headings.indexOf('Notes')]).whiteSpace).toBe('pre-wrap');
  });

  it('says which language it is written in', () => {
    const { container, rerender } = render(<ReportView report={make([clean('2026-07-01')])} />);
    expect(container.querySelector('.report-doc').getAttribute('lang')).toBe('en');
    rerender(<ReportView report={make([clean('2026-07-01')], { lang: 'es' })} />);
    expect(container.querySelector('.report-doc').getAttribute('lang')).toBe('es');
  });

  it('carries the class the print styles look for', () => {
    const { container } = render(<ReportView report={make([clean('2026-07-01')])} />);
    expect(container.querySelector('.report-doc')).not.toBeNull();
  });
});

const assessed = (date, source, extra = {}) => rec('water_assessment', date, {
  source, source_type: 'groundwater_protected', fields_served: 'A1, A2', application_method: 'drip',
  source_concern: 'low', nearby_concern: 'some', practice_concern: 'low', crop_concern: 'low', weather_concern: 'low', testing_concern: 'low',
  conclusion: 'no_mitigation', ...extra,
});
const SOURCE = 'Water source or system';

describe('ReportView: a log with many fields', () => {
  it('shows each record as a column headed by its date, with the name of every field down the side', () => {
    render(<ReportView report={make([assessed('2026-03-01', 'Well 1'), assessed('2026-06-10', 'Canal')])} />);
    const table = screen.getByRole('table', { name: /Water Assessments/ });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Date', '2026-03-01', '2026-06-10']);
    const rows = within(table).getAllByRole('row').slice(1);
    const rowHeadings = rows.map((row) => within(row).getByRole('rowheader').textContent);
    expect(rowHeadings.slice(0, 2)).toEqual([SOURCE, 'What kind of source it is']);
    expect(rowHeadings.at(-1)).toBe('Approved');
    const sourceRow = rows[rowHeadings.indexOf(SOURCE)];
    expect(within(sourceRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Well 1', 'Canal']);
  });

  it('lists the fields once down the side rather than once per record', () => {
    render(<ReportView report={make([assessed('2026-03-01', 'Well 1'), assessed('2026-06-10', 'Canal'), assessed('2026-07-10', 'Pond')])} />);
    expect(screen.getAllByRole('rowheader', { name: SOURCE })).toHaveLength(1);
    expect(screen.getAllByRole('table')).toHaveLength(2); // the summary and the log
  });

  it('carries on in another table when there are more records than fit across, and says so', () => {
    const records = Array.from({ length: 6 }, (_, index) => assessed(`2026-0${index + 1}-01`, `Well ${index + 1}`));
    const { container } = render(<ReportView report={make(records)} />);
    const tables = screen.getAllByRole('table', { name: /Water Assessments/ });
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Date', '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']);
    expect(within(tables[1]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Date', '2026-05-01', '2026-06-01']);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByText('Water Assessments — continued')).toBeTruthy();
    expect(container.querySelectorAll('.report-chunk')).toHaveLength(2);
  });

  it('shows only the first records in a preview', () => {
    const records = Array.from({ length: 6 }, (_, index) => assessed(`2026-0${index + 1}-01`, `Well ${index + 1}`));
    render(<ReportView report={make(records)} maxRows={2} />);
    const tables = screen.getAllByRole('table', { name: /Water Assessments/ });
    expect(tables).toHaveLength(1);
    expect(within(tables[0]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Date', '2026-01-01', '2026-02-01']);
  });

  it('puts a short log in an ordinary table with the dates down the side, as before', () => {
    render(<ReportView report={make([clean('2026-07-01')])} />);
    const table = screen.getByRole('table', { name: /Sanitation Log/ });
    expect(within(table).queryAllByRole('rowheader')).toHaveLength(0);
    expect(within(table).getAllByRole('columnheader')[0].textContent).toBe('Date');
  });

  it('reads in Spanish', () => {
    const records = Array.from({ length: 5 }, (_, index) => assessed(index === 4 ? null : `2026-0${index + 1}-01`, `Pozo ${index + 1}`));
    render(<ReportView report={make(records, { lang: 'es' })} />);
    expect(screen.getByText('Evaluaciones del Agua — continuación')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Sin fecha' })).toBeTruthy();
    expect(screen.getAllByRole('rowheader', { name: 'Fuente o sistema de agua' }).length).toBeGreaterThan(0);
  });

  it('keeps a table together on one page when it is printed', () => {
    const { container } = render(<ReportView report={make([assessed('2026-03-01', 'Well 1')])} />);
    expect(container.querySelector('.report-chunk table')).not.toBeNull();
  });
});
