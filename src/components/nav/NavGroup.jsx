import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
const storageKey = (id) => `farmsafe_nav_group_${id}`;

/** A remembered open/closed choice; browser storage can be missing or full, which only means nothing is remembered. */
function loadOpen(id, fallback) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(id)) ?? 'null');
    return typeof saved === 'boolean' ? saved : fallback;
  } catch {
    return fallback;
  }
}

function saveOpen(id, open) {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(open));
  } catch {
    // nothing to do: the choice just is not remembered
  }
}

/**
 * A menu section. With a `label` it can be collapsed, and the choice is remembered per section.
 * `forceOpen` keeps it open while the current page is inside it, without overwriting what was saved.
 * Without a `label` it is just a plain, always-visible list.
 *
 * Give it an `icon` and/or an `accent` colour and it becomes a card of its own: a clearly titled block
 * with a small tinted icon, so the main sections are easy to tell apart at a glance. `count` (how many
 * items it holds) is shown only while the card is collapsed, so a closed section never looks empty.
 */
export default function NavGroup({ id, label, icon: Icon, accent, count, defaultOpen = true, forceOpen = false, children }) {
  const regionId = useId();
  const [open, setOpen] = useState(() => loadOpen(id, defaultOpen));

  if (!label) return <div>{children}</div>;

  const shown = open || forceOpen;
  const toggle = () => {
    const next = !shown;
    setOpen(next);
    saveOpen(id, next);
  };
  const Chevron = shown ? ChevronDown : ChevronRight;
  const asCard = Boolean(Icon || accent);

  if (!asCard) {
    return (
      <div>
        <button type="button" className="nav-group-header" onClick={toggle} aria-expanded={shown} aria-controls={regionId}>
          <span>{label}</span>
          <Chevron size={12} aria-hidden="true" />
        </button>
        <div id={regionId} hidden={!shown}>{shown ? children : null}</div>
      </div>
    );
  }

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
