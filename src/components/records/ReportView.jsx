import { useId } from 'react';
import { recordTables } from '../../domain/records/report.js';

/** Columns that hold a date: these never wrap, so a date is not split over two lines. */
const DATE_COLUMNS = new Set(['record_date', 'approved']);

/** One record per row, the fields across: for a log with few fields. */
function RowTable({ section, labelledBy, rows }) {
  return (
    <table aria-labelledby={labelledBy}>
      <thead>
        <tr>
          {section.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((value, columnIndex) => {
              const { key } = section.columns[columnIndex];
              return DATE_COLUMNS.has(key)
                ? <td key={key} className="report-date">{value}</td>
                : <td key={key} style={{ whiteSpace: 'pre-wrap' }}>{value}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One record per column, headed by its date, with the fields down the side: for a log with many fields, which across the
 * page would be squeezed too narrow to read. Records beyond what fits across carry on in a table below, each kept whole on a page.
 */
function DateTables({ section, labelledBy, rows, text }) {
  return recordTables({ ...section, rows }).map((table, index) => (
    <div key={index} className="report-chunk">
      {table.continued && <p className="report-continued">{`${section.title} — ${text.continued}`}</p>}
      <table className="report-by-date" aria-labelledby={labelledBy}>
        <thead>
          <tr>
            <th scope="col">{section.columns[0].label}</th>
            {table.dates.map((date, dateIndex) => <th key={dateIndex} scope="col">{date}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, valueIndex) => <td key={valueIndex} style={{ whiteSpace: 'pre-wrap' }}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ));
}

/**
 * A report (see domain/records/report.js) as a page. The same component is the on-screen preview and
 * what the browser prints or saves as PDF; the look, including the print rules, is in the `.report-doc`
 * styles of styles/global.js. All text is rendered as text, never as markup.
 *
 * `maxRows` shows only the first rows of each log (for a preview); leave it out for the full report.
 */
export default function ReportView({ report, maxRows }) {
  const { text } = report;
  const id = useId();
  const shownRows = (rows) => (maxRows === undefined ? rows : rows.slice(0, maxRows));

  return (
    <article className="report-doc" lang={report.lang}>
      <h1>{report.title}</h1>

      <dl className="report-meta">
        {report.header.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {report.sections.length === 0 ? (
        <p className="report-note">{text.empty}</p>
      ) : (
        <table className="report-summary" aria-label={text.summary}>
          <thead>
            <tr>
              <th scope="col">{text.summary}</th>
              <th scope="col">{text.header.records}</th>
            </tr>
          </thead>
          <tbody>
            {report.sections.map((section) => (
              <tr key={section.kind}>
                <td>{section.title}</td>
                <td>{text.count(section.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {report.sections.map((section) => (
        <section key={section.kind} className="report-section">
          <h2 id={`${id}-${section.kind}`}>{`${section.title} — ${text.count(section.count)}`}</h2>
          {section.layout === 'by_date'
            ? <DateTables section={section} labelledBy={`${id}-${section.kind}`} rows={shownRows(section.rows)} text={text} />
            : <RowTable section={section} labelledBy={`${id}-${section.kind}`} rows={shownRows(section.rows)} />}
        </section>
      ))}

      {report.truncated && <p className="report-note">{text.truncated}</p>}

      <div className="report-sign">
        <div><span className="report-line" />{text.signature.preparedBy}</div>
        <div><span className="report-line" />{text.signature.signature}</div>
        <div><span className="report-line" />{text.signature.date}</div>
      </div>

      <p className="report-foot">{text.footer}</p>
    </article>
  );
}
