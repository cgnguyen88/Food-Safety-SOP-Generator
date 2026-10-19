// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

const fake = vi.hoisted(() => {
  const state = {};
  const reset = () => {
    Object.assign(state, {
      session: null,
      users: {},
      rows: new Map(), // key -> { value, version }
      failSaves: false,
      loadGate: null,
      listeners: [],
    });
  };
  reset();
  const rowsAsList = () => [...state.rows].map(([key, row]) => ({ key, value: row.value, version: row.version }));
  const query = (table) => {
    const filters = [];
    const q = {
      select: () => q,
      eq: (column, value) => { filters.push([column, value]); return q; },
      maybeSingle: async () => {
        const user = state.users[state.session?.user?.id];
        if (table === 'farms') return { data: { id: 'farm-1', name: 'Green Valley', farm_code: 'F-ABC234' }, error: null };
        if (table === 'farm_members') return { data: { role: user?.role ?? 'owner' }, error: null };
        return { data: { first_name: user?.firstName ?? 'Ana', last_name: 'Reyes', phone: '', organization: 'Green Valley', job_role: 'owner' }, error: null };
      },
      then: (resolve, reject) => Promise.resolve({ data: rowsAsList(), error: null }).then(resolve, reject),
      insert: async (row) => {
        if (state.rows.has(row.key)) return { error: { code: '23505', message: 'duplicate key' } };
        state.rows.set(row.key, { value: row.value, version: 1 });
        return { error: null };
      },
    };
    return q;
  };
  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session } })),
      onAuthStateChange: vi.fn((callback) => {
        state.listeners.push(callback);
        return { data: { subscription: { unsubscribe: () => {} } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(query),
    rpc: vi.fn(async (fn, args) => {
      if (fn === 'ensure_my_farm') {
        if (state.loadGate) await state.loadGate;
        return { data: 'farm-1', error: null };
      }
      if (fn !== 'put_farm_data') return { data: null, error: { message: 'unknown' } };
      if (state.failSaves) return { data: null, error: { code: 'XX000', message: 'offline' } };
      const row = state.rows.get(args.p_key);
      if ((row?.version ?? null) !== args.p_expected_version) return { data: null, error: { code: 'FD409', message: 'changed' } };
      const version = (row?.version ?? 0) + 1;
      state.rows.set(args.p_key, { value: args.p_value, version });
      return { data: version, error: null };
    }),
  };
  return { state, reset, supabase };
});

vi.mock('./supabase.js', () => ({ supabase: fake.supabase }));

const { default: useFarmAccount } = await import('./useFarmAccount.js');

const ANA = { user: { id: 'user-ana', email: 'ana@example.com' } };
const LUIS = { user: { id: 'user-luis', email: 'luis@example.com' } };
const putCalls = () => fake.supabase.rpc.mock.calls.filter(([fn]) => fn === 'put_farm_data').map(([, args]) => args);
const emitAuth = (event, session) => act(async () => {
  fake.state.session = session;
  for (const listener of fake.state.listeners) listener(event, session);
});

async function signedIn(session = ANA) {
  fake.state.session = session;
  const view = renderHook(() => useFarmAccount({ saveDelayMs: 5 }));
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  return view;
}

beforeEach(() => {
  fake.reset();
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('useFarmAccount: signing in', () => {
  it('shows the sign-in screen when nobody is signed in', async () => {
    const { result } = renderHook(() => useFarmAccount());
    await waitFor(() => expect(result.current.status).toBe('signed-out'));
  });

  it("loads the person's farm and its data", async () => {
    fake.state.rows.set('incidents', { value: [{ id: 'a' }], version: 1 });
    const { result } = await signedIn();
    expect(result.current.account).toMatchObject({ farmId: 'farm-1', role: 'owner', user: { name: 'Ana Reyes' } });
    expect(result.current.data.incidents).toEqual([{ id: 'a' }]);
    expect(result.current.data.farm_profile).toBeNull();
  });

  it("never shows the previous person's farm while the next one loads", async () => {
    fake.state.rows.set('incidents', { value: [{ id: 'ana-only' }], version: 1 });
    const { result } = await signedIn();
    let open;
    fake.state.loadGate = new Promise((resolve) => { open = resolve; });
    await emitAuth('SIGNED_IN', LUIS);
    expect(result.current.status).toBe('loading');
    expect(result.current.data.incidents).toEqual([]);
    await act(async () => open());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});

describe('useFarmAccount: saving', () => {
  it('shows a change at once and saves it over the version it read', async () => {
    fake.state.rows.set('incidents', { value: [{ id: 'a' }], version: 1 });
    const { result } = await signedIn();
    act(() => result.current.setValue('incidents', (list) => [...list, { id: 'b' }]));
    expect(result.current.data.incidents).toEqual([{ id: 'a' }, { id: 'b' }]);
    await waitFor(() => expect(fake.state.rows.get('incidents')).toEqual({ value: [{ id: 'a' }, { id: 'b' }], version: 2 }));
    expect(putCalls()[0]).toMatchObject({ p_key: 'incidents', p_expected_version: 1 });
    await waitFor(() => expect(result.current.saveStatus.state).toBe('saved'));
  });

  it('builds each change on the latest value, so quick changes in a row all count', async () => {
    const { result } = await signedIn();
    act(() => {
      result.current.setValue('incidents', (list) => [...list, { id: 'a' }]);
      result.current.setValue('incidents', (list) => [...list, { id: 'b' }]);
    });
    await waitFor(() => expect(fake.state.rows.get('incidents')?.value).toEqual([{ id: 'a' }, { id: 'b' }]));
  });

  it("merges with another device's save instead of overwriting it, and says so", async () => {
    fake.state.rows.set('incidents', { value: [{ id: 'a' }], version: 1 });
    const { result } = await signedIn();
    fake.state.rows.set('incidents', { value: [{ id: 'a' }, { id: 'from-phone' }], version: 2 });
    act(() => result.current.setValue('incidents', (list) => [...list, { id: 'from-laptop' }]));
    await waitFor(() => expect(fake.state.rows.get('incidents')).toEqual({ value: [{ id: 'a' }, { id: 'from-phone' }, { id: 'from-laptop' }], version: 3 }));
    expect(result.current.data.incidents).toEqual([{ id: 'a' }, { id: 'from-phone' }, { id: 'from-laptop' }]);
    expect(result.current.mergedNotice).toBe(true);
  });

  it('reads the data again when the tab comes back into view', async () => {
    const { result } = await signedIn();
    fake.state.rows.set('cost_settings', { value: { wage: 22 }, version: 1 });
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.data.cost_settings).toEqual({ wage: 22 }));
  });

  it('keeps unsaved changes when the session ends elsewhere, and saves them at the next sign-in', async () => {
    const { result } = await signedIn();
    fake.state.failSaves = true;
    act(() => result.current.setValue('incidents', [{ id: 'unsaved' }]));
    await waitFor(() => expect(result.current.saveStatus.state).toBe('error'));
    await emitAuth('SIGNED_OUT', null);
    expect(result.current.status).toBe('signed-out');
    expect(JSON.parse(localStorage.getItem('farmsafe_unsaved:farm-1'))).toEqual({ incidents: [{ id: 'unsaved' }] });

    fake.state.failSaves = false;
    await emitAuth('SIGNED_IN', ANA);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.incidents).toEqual([{ id: 'unsaved' }]);
    await waitFor(() => expect(fake.state.rows.get('incidents')?.value).toEqual([{ id: 'unsaved' }]));
    expect(localStorage.getItem('farmsafe_unsaved:farm-1')).toBeNull();
  });
});

describe('useFarmAccount: signing out', () => {
  it('saves what is waiting, then signs out of this device only', async () => {
    const { result } = await signedIn();
    act(() => result.current.setValue('farm_profile', { farm_name: 'GV' }));
    let done;
    await act(async () => { done = await result.current.signOut(); });
    expect(done).toBe(true);
    expect(fake.state.rows.get('farm_profile')?.value).toEqual({ farm_name: 'GV' });
    expect(fake.supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result.current.status).toBe('signed-out');
  });

  it('stays signed in when changes cannot be saved and the person chooses to stay', async () => {
    const { result } = await signedIn();
    fake.state.failSaves = true;
    act(() => result.current.setValue('farm_profile', { farm_name: 'GV' }));
    let done;
    await act(async () => { done = await result.current.signOut({ confirmUnsaved: () => false }); });
    expect(done).toBe(false);
    expect(fake.supabase.auth.signOut).not.toHaveBeenCalled();
    expect(result.current.status).toBe('ready');
  });

  it('starts the next sign-in without the previous save error', async () => {
    const { result } = await signedIn();
    fake.state.failSaves = true;
    act(() => result.current.setValue('farm_profile', { farm_name: 'GV' }));
    await waitFor(() => expect(result.current.saveStatus.state).toBe('error'));
    await act(async () => { await result.current.signOut({ confirmUnsaved: () => true }); });
    fake.state.failSaves = false;
    await emitAuth('SIGNED_IN', ANA);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.saveStatus).toEqual({ state: 'saved', error: null });
  });
});

describe("useFarmAccount: this browser's data from before accounts", () => {
  beforeEach(() => {
    localStorage.setItem('incidents', JSON.stringify([{ id: 'old' }]));
    localStorage.setItem('current_user', JSON.stringify({ email: 'old@example.com', password: 'plain' }));
  });

  it('offers to copy it, saying whose it was, and copies nothing until accepted', async () => {
    const { result } = await signedIn();
    expect(result.current.importOffer).toEqual({ values: { incidents: [{ id: 'old' }] }, owner: 'old@example.com' });
    expect(fake.state.rows.has('incidents')).toBe(false);
    expect(localStorage.getItem('current_user')).toBeNull();

    await act(async () => { await result.current.acceptImport(); });
    expect(fake.state.rows.get('incidents')?.value).toEqual([{ id: 'old' }]);
    expect(result.current.data.incidents).toEqual([{ id: 'old' }]);
    expect(result.current.importResult.imported).toEqual(['incidents']);
    expect(result.current.importOffer).toBeNull();
    expect(localStorage.getItem('incidents')).toBeNull();
  });

  it('leaves it in the browser when declined', async () => {
    const { result } = await signedIn();
    act(() => result.current.declineImport());
    expect(result.current.importOffer).toBeNull();
    expect(localStorage.getItem('incidents')).not.toBeNull();
  });

  it('does not offer it to crew, who cannot change the farm data', async () => {
    fake.state.users['user-ana'] = { role: 'crew' };
    const { result } = await signedIn();
    expect(result.current.importOffer).toBeNull();
  });
});
