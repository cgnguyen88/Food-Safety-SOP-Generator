import { useEffect, useEffectEvent, useState } from 'react';

const NONE = Object.freeze([]);
const LOADING = Object.freeze({ farmId: null, status: 'loading', items: NONE, errorCode: null });
const NOTHING_TO_READ = Object.freeze({ status: 'ready', items: NONE, errorCode: null });

/**
 * Reads one of a farm's lists (its fields, its water sources) with `list(farmId)`, which resolves to `{ data, error }`. It reads
 * again only when the farm changes or `reload` is called, shows "loading" with no items as soon as the farm changes (never
 * another farm's list), keeps showing the list it has while it reads again (and after a failed read), and ignores an answer
 * that arrives late for a farm it is no longer asking about. A farm that does not exist yet has nothing to read.
 *
 * @param {string | undefined} farmId
 * @param {(farmId: string) => Promise<{ data: object[] | null, error: { code?: string } | null }>} list
 * @param {string} label what the list is, for the log when reading throws
 * @returns {{ status: 'loading' | 'ready' | 'error', items: object[], errorCode: string | null, reload: () => void }} `errorCode` says why a read failed
 */
export default function useLoadFarmList(farmId, list, label) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(LOADING);

  const read = useEffectEvent(() => list(farmId));
  useEffect(() => {
    if (!farmId) return undefined;
    let alive = true;
    // A failed read keeps the list this farm already had (a failed reload must not empty the screen).
    const finish = (result) => {
      if (!alive) return;
      setLoaded((current) => {
        const had = current.farmId === farmId ? current.items : NONE;
        return result.error ? { farmId, status: 'error', items: had, errorCode: result.error.code ?? 'unknown' } : { farmId, status: 'ready', items: result.data, errorCode: null };
      });
    };
    read().then(finish, (error) => {
      console.error(`${label}:`, error);
      finish({ error });
    });
    return () => { alive = false; };
  }, [farmId, attempt, label]);

  const current = !farmId ? NOTHING_TO_READ : loaded.farmId === farmId ? loaded : LOADING;
  return { status: current.status, items: current.items, errorCode: current.errorCode, reload: () => setAttempt((n) => n + 1) };
}
