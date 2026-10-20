import { useState } from 'react';

/**
 * Whether a drop-down section is open, remembered in this browser under `storageKey`. Anything stored that is not a
 * yes/no is ignored, and a browser that will not store anything (a private window, blocked site data) just forgets
 * the choice when the page is left: the section still opens and closes.
 *
 * @param {string} storageKey
 * @param {boolean} [defaultOpen]
 * @returns {[boolean, (open: boolean) => void]}
 */
export default function useRememberedOpen(storageKey, defaultOpen = true) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return typeof saved === 'boolean' ? saved : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const remember = (next) => {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage is blocked: the choice lasts until the page is left, which is all that can be done.
    }
  };

  return [open, remember];
}
