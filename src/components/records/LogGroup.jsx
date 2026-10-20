import { useId } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import useRememberedOpen from '../../lib/useRememberedOpen.js';

const storageKey = (id) => `farmsafe_records_group_${id}`;

/**
 * One group on the Records page: a card whose heading opens a list, one item under the other, and closes it again.
 * The choice is remembered for next time. The group's name is written as it is (not in capitals) in a dark, readable
 * colour; styling comes from the `.log-group` rules in global.js.
 *
 * @param {{ id: string, label: string, icon: import('react').ElementType, accent: string, count: number, defaultOpen?: boolean, children: import('react').ReactNode }} props
 *   `children` are the list items (`<li className="log-row">`).
 */
export default function LogGroup({ id, label, icon: Icon, accent, count, defaultOpen = false, children }) {
  const listId = useId();
  const [open, setOpen] = useRememberedOpen(storageKey(id), defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section className="log-group" aria-label={label} style={{ '--group-accent': accent }}>
      <button type="button" className="log-group-header" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={listId}>
        <span className="log-group-icon" aria-hidden="true" style={{ background: `${accent}1f` }}>
          <Icon size={17} color={accent} />
        </span>
        <span className="log-group-title">{label}</span>
        <span className="log-group-count" aria-hidden="true">{count}</span>
        <Chevron size={16} aria-hidden="true" className="log-group-chevron" />
      </button>
      <ul id={listId} className="log-group-body" hidden={!open} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {open ? children : null}
      </ul>
    </section>
  );
}
