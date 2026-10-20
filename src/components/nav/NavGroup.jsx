import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import useRememberedOpen from '../../lib/useRememberedOpen.js';

const storageKey = (id) => `farmsafe_menu_section_${id}`;

/**
 * A menu section: a card with a small tinted icon, a clear title and a heading that opens and closes it (the choice is
 * remembered per section). `count` (how many items it holds) is shown only while it is closed, so a closed section never
 * looks empty.
 *
 * `forceOpen` is for "the current page is inside this section": it opens the section when the page moves into it, without
 * overwriting what was saved. It never takes the heading away: a section can always be closed, and then stays closed
 * while the page changes inside it, until the page leaves and comes back.
 */
export default function NavGroup({ id, label, icon: Icon, accent, count, defaultOpen = true, forceOpen = false, children }) {
  const regionId = useId();
  const [open, setOpen] = useRememberedOpen(storageKey(id), defaultOpen);
  // Closed by hand while the page is inside it. Cleared when the page leaves, so coming back opens it again.
  const [closedByHand, setClosedByHand] = useState(false);
  const [wasForced, setWasForced] = useState(forceOpen);
  if (forceOpen !== wasForced) {
    setWasForced(forceOpen);
    if (!forceOpen) setClosedByHand(false);
  }

  const shown = open || (forceOpen && !closedByHand);
  const Chevron = shown ? ChevronDown : ChevronRight;
  const toggle = () => {
    setOpen(!shown);
    setClosedByHand(shown);
  };

  return (
    <section className="nav-section" style={accent ? { '--section-accent': accent } : undefined}>
      <button type="button" className="nav-section-header" onClick={toggle} aria-expanded={shown} aria-controls={regionId}>
        {Icon && <span className="nav-section-icon" aria-hidden="true"><Icon size={13} strokeWidth={2} /></span>}
        <span className="nav-section-title">{label}</span>
        {!shown && count > 0 && <span className="nav-section-count">{count}</span>}
        <Chevron size={14} aria-hidden="true" className="nav-section-chevron" />
      </button>
      <div id={regionId} hidden={!shown} className="nav-section-body">{shown ? children : null}</div>
    </section>
  );
}
