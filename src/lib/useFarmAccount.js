import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { loadAccount } from "./account.js";
import {
  createSaveQueue, fetchFarmData, findLocalData, forgetOldAccounts, importLocalData, pruneBackups, saveFarmData,
  stashUnsaved, takeUnsaved,
} from "./farmData.js";
import { mergeChanges } from "./merge.js";
import { clearSuggestionCache } from "../utils/api.js";
import { DEFAULT_COST_SETTINGS } from "../data/cost-defaults.js";

const EMPTY_DATA = Object.freeze({
  farm_profile: null,
  incidents: [],
  cost_settings: DEFAULT_COST_SETTINGS,
  sop_activity_records: [],
});

const NO_IMPORT = Object.freeze({ imported: [], kept: [], failed: [] });
const SAVED = Object.freeze({ state: "saved", error: null });
const WRITER_ROLES = ["owner", "manager"];

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode or blocked storage
  }
}

/**
 * The signed-in person, their farm and the farm's shared data, kept in step with the server.
 *
 * `status` is "checking" (looking for a saved session), "signed-out", "loading" (reading the farm),
 * "ready" or "error". A change made with `setValue` shows at once and is saved a moment later, over
 * the version this device last read; if another device saved first, both sets of changes are merged
 * and saved again. The data is read again whenever the tab comes back into view.
 */
export default function useFarmAccount({ saveDelayMs = 800 } = {}) {
  const [session, setSession] = useState(undefined);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [account, setAccount] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [error, setError] = useState("");
  const [importOffer, setImportOffer] = useState(null);
  const [importResult, setImportResult] = useState(NO_IMPORT);
  const [mergedNotice, setMergedNotice] = useState(false);
  const [saveStatus, setSaveStatus] = useState(SAVED);
  const [attempt, setAttempt] = useState(0);

  const dataRef = useRef(EMPTY_DATA); // what the screens show, including changes not saved yet
  const baseRef = useRef({}); // what this device last read from, or saved to, the server
  const versionsRef = useRef({});
  const queueRef = useRef(null);
  const farmIdRef = useRef(null);

  const showData = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  // Stop saving for the current farm. Changes not saved yet are kept in the browser for next time
  // (the session ended here or in another tab), so they can be saved at the next sign-in.
  const stopSaving = useCallback(() => {
    const queue = queueRef.current;
    if (!queue) return;
    queueRef.current = null;
    const pending = queue.pendingKeys();
    const storage = browserStorage();
    if (pending.length && storage && farmIdRef.current) {
      stashUnsaved(storage, farmIdRef.current, Object.fromEntries(pending.map((key) => [key, dataRef.current[key]])));
    }
    queue.cancel();
  }, []);

  const adoptServer = useCallback((latest, keys = Object.keys(latest.data)) => {
    for (const key of keys) {
      baseRef.current = { ...baseRef.current, [key]: latest.data[key] };
      versionsRef.current = { ...versionsRef.current, [key]: latest.versions[key] };
    }
  }, []);

  useEffect(() => {
    const storage = browserStorage();
    if (storage) {
      forgetOldAccounts(storage);
      pruneBackups(storage);
    }
    supabase.auth.getSession().then(({ data: { session: saved } }) => setSession(saved ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_IN") setJustSignedIn(true);
      setSession(next ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const authUser = session?.user ?? null;
  const userId = authUser?.id ?? null;

  useEffect(() => {
    // A different person (or nobody): never show the previous person's farm while the next one loads.
    stopSaving();
    setAccount(null);
    showData(EMPTY_DATA);
    baseRef.current = {};
    versionsRef.current = {};
    setImportOffer(null);
    setImportResult(NO_IMPORT);
    setMergedNotice(false);
    setSaveStatus(SAVED);
    if (!userId) return undefined;

    let cancelled = false;
    setError("");
    (async () => {
      try {
        const loaded = await loadAccount(supabase, authUser);
        const latest = await fetchFarmData(supabase, loaded.farmId);
        if (cancelled) return;
        adoptServer(latest);
        const storage = browserStorage();
        const unsaved = storage ? takeUnsaved(storage, loaded.farmId) : {};
        const shown = { ...EMPTY_DATA, ...latest.data };
        for (const [key, value] of Object.entries(unsaved)) shown[key] = mergeChanges(undefined, value, latest.data[key]);
        showData(shown);
        setAccount({ ...loaded, unsavedKeys: Object.keys(unsaved) });
        if (storage && WRITER_ROLES.includes(loaded.role)) {
          const local = findLocalData(storage);
          if (Object.keys(local.values).length) setImportOffer(local);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // authUser changes on every token refresh; only a different person (or a retry) reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attempt]);

  useEffect(() => {
    if (!account) return undefined;
    const { farmId } = account;

    // Save the latest value of one kind. If another device saved first, merge and try once more.
    const save = async (key) => {
      const value = dataRef.current[key];
      try {
        versionsRef.current = { ...versionsRef.current, [key]: await saveFarmData(supabase, farmId, key, value, versionsRef.current[key]) };
        baseRef.current = { ...baseRef.current, [key]: value };
        return;
      } catch (saveError) {
        if (saveError.code !== "conflict") throw saveError;
      }
      const latest = await fetchFarmData(supabase, farmId);
      const merged = mergeChanges(baseRef.current[key], value, latest.data[key]);
      // Keep anything typed while this save was under way.
      const shown = mergeChanges(value, dataRef.current[key], merged);
      showData({ ...dataRef.current, [key]: shown });
      adoptServer(latest, [key]);
      versionsRef.current = { ...versionsRef.current, [key]: await saveFarmData(supabase, farmId, key, shown, latest.versions[key]) };
      baseRef.current = { ...baseRef.current, [key]: shown };
      setMergedNotice(true);
    };

    const queue = createSaveQueue({ save, delayMs: saveDelayMs, onStatus: setSaveStatus });
    queueRef.current = queue;
    farmIdRef.current = farmId;
    // Changes left unsaved last time (shown already), plus any put back by a remount of this effect.
    const storage = browserStorage();
    const restashed = storage ? Object.keys(takeUnsaved(storage, farmId)) : [];
    for (const key of new Set([...(account.unsavedKeys ?? []), ...restashed])) queue.queue(key, null);

    const refresh = async () => {
      if (queue.hasPending()) return;
      try {
        const latest = await fetchFarmData(supabase, farmId);
        if (queue.hasPending()) return; // a change arrived meanwhile; its save will merge
        adoptServer(latest);
        showData({ ...EMPTY_DATA, ...latest.data });
      } catch {
        // offline: keep showing what we have
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") queue.flush();
      else refresh();
    };
    const onPageHide = () => {
      queue.flush();
    };
    const warnBeforeLeaving = (event) => {
      if (!queue.hasPending()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      if (queueRef.current === queue) stopSaving();
    };
  }, [account, adoptServer, showData, stopSaving, saveDelayMs]);

  /** Show a change now and save it shortly. `update` is the new value, or a function of the current one. */
  const setValue = useCallback((key, update) => {
    const value = typeof update === "function" ? update(dataRef.current[key]) : update;
    showData({ ...dataRef.current, [key]: value });
    queueRef.current?.queue(key, value);
  }, [showData]);

  const retrySaves = useCallback(() => queueRef.current?.retry(), []);
  const retryLoad = useCallback(() => setAttempt((n) => n + 1), []);
  const dismissImport = useCallback(() => setImportResult(NO_IMPORT), []);
  const dismissMerged = useCallback(() => setMergedNotice(false), []);
  const declineImport = useCallback(() => setImportOffer(null), []);

  /** Copy this browser's old data into the farm (the person agreed to it). */
  const acceptImport = useCallback(async () => {
    const storage = browserStorage();
    if (!account || !storage) return;
    setImportOffer(null);
    try {
      const current = { data: baseRef.current, versions: versionsRef.current };
      const result = await importLocalData({ client: supabase, farmId: account.farmId, storage, current });
      const copied = [...result.imported, ...result.kept];
      adoptServer(result, copied.filter((key) => Object.hasOwn(result.data, key)));
      // Anything changed here before the copy finished stays on top of the copied data.
      const next = { ...dataRef.current };
      for (const key of result.imported) {
        next[key] = next[key] == null ? result.data[key] : mergeChanges(EMPTY_DATA[key], next[key], result.data[key]);
      }
      showData(next);
      setImportResult({ imported: result.imported, kept: result.kept, failed: result.failed });
    } catch (importError) {
      setImportResult({ imported: [], kept: [], failed: Object.keys(findLocalData(storage).values), error: importError.message });
    }
  }, [account, adoptServer, showData]);

  /**
   * Save what is waiting, then sign out of this device only. Resolves false (still signed in) when the
   * person chose to stay because some changes could not be saved.
   */
  const signOut = useCallback(async ({ confirmUnsaved = () => true } = {}) => {
    const queue = queueRef.current;
    if (queue) {
      await queue.flush();
      if (queue.hasPending() && !confirmUnsaved()) return false;
      queue.cancel(); // the person chose to drop what could not be saved
    }
    clearSuggestionCache();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setSession(null);
    setJustSignedIn(false);
    return true;
  }, []);

  let status = "ready";
  if (session === undefined) status = "checking";
  else if (!session) status = "signed-out";
  else if (error) status = "error";
  else if (!account) status = "loading";

  return {
    status, error, account, data, setValue, saveStatus, retrySaves, retryLoad,
    importOffer, acceptImport, declineImport, importResult, dismissImport,
    mergedNotice, dismissMerged, signOut, justSignedIn,
  };
}
