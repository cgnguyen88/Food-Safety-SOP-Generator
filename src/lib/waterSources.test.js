import { describe, it, expect, vi, beforeEach } from 'vitest';

// A chainable stand-in for a supabase-js query: records every call, resolves to `result` when awaited.
function chain(result) {
  const calls = [];
  const proxy = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); return proxy; };
    },
  });
  return proxy;
}
const from = vi.fn();
vi.mock('./supabase.js', () => ({ supabase: { from: (...a) => from(...a) } }));

const { listWaterSources, createWaterSource, updateWaterSource, setWaterSourceActive, deleteWaterSource, addWaterSources, describeWaterSourceError, MAX_WATER_SOURCES_AT_ONCE } = await import('./waterSources.js');

const args = (q, name) => q.calls.filter((c) => c[0] === name).map((c) => c.slice(1));

beforeEach(() => {
  from.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('describeWaterSourceError', () => {
  it.each([
    [{ code: '42501' }, 'forbidden'],
    [{ code: 'PGRST116' }, 'forbidden'],
    [{ code: '23505' }, 'duplicate'],
    [{ code: '23514', message: 'The water source "Well 1" is used by records and cannot be renamed.' }, 'in_use'],
    [{ code: '23514', message: 'The water source "Well 1" is used by records and cannot be deleted. Archive it instead.' }, 'in_use'],
    [{ code: '23514', message: 'new row violates check constraint "water_sources_name_check"' }, 'invalid'],
    [{ code: '23514', message: 'A farm can have at most 200 water sources.' }, 'too_many'],
    [{ code: 'PGRST205', message: "Could not find the table 'public.water_sources' in the schema cache" }, 'not_set_up'],
    [{ code: '42P01', message: 'relation "public.water_sources" does not exist' }, 'not_set_up'],
    [{ code: '08006', message: 'x' }, 'unknown'],
    [null, 'unknown'],
  ])('turns %j into %s', (dbError, code) => {
    expect(describeWaterSourceError(dbError).code).toBe(code);
  });
});

describe('listWaterSources', () => {
  it('lists this farm’s sources, those in use first, then by name', async () => {
    const q = chain({ data: [{ id: 's1', name: 'Well 1' }], error: null });
    from.mockReturnValue(q);
    expect(await listWaterSources('farm-1')).toEqual({ data: [{ id: 's1', name: 'Well 1' }], error: null });
    expect(from).toHaveBeenCalledWith('water_sources');
    expect(args(q, 'eq')).toEqual([['farm_id', 'farm-1']]);
    expect(args(q, 'order')).toEqual([['is_active', { ascending: false }], ['name', { ascending: true }]]);
  });

  it('gives an empty list for a farm with none, and refuses without a farm', async () => {
    from.mockReturnValue(chain({ data: null, error: null }));
    expect(await listWaterSources('farm-1')).toEqual({ data: [], error: null });
    expect((await listWaterSources('')).error.code).toBe('invalid');
  });

  it('says why it could not, and says the database update is missing when the table is', async () => {
    from.mockReturnValue(chain({ data: null, error: { code: 'PGRST205', message: 'no table' } }));
    expect((await listWaterSources('farm-1')).error.code).toBe('not_set_up');
  });
});

describe('createWaterSource', () => {
  it('checks and tidies what was typed, then adds it to the farm', async () => {
    const q = chain({ data: { id: 's1' }, error: null });
    from.mockReturnValue(q);
    const result = await createWaterSource({ farmId: 'farm-1', name: ' Well  1 ', source_type: 'canal', fields_served: 'A1', notes: '' });
    expect(result.data).toEqual({ id: 's1' });
    expect(args(q, 'insert')).toEqual([[{ farm_id: 'farm-1', name: 'Well 1', source_type: 'canal', fields_served: 'A1', notes: null }]]);
  });

  it('says what is wrong without asking the database, and refuses without a farm', async () => {
    const result = await createWaterSource({ farmId: 'farm-1', name: '' });
    expect(result.error).toEqual({ code: 'invalid', fields: { name: 'required' } });
    expect(from).not.toHaveBeenCalled();
    expect((await createWaterSource({ farmId: '', name: 'x' })).error.code).toBe('invalid');
  });

  it('reports a name that is taken', async () => {
    from.mockReturnValue(chain({ data: null, error: { code: '23505', message: 'duplicate' } }));
    expect((await createWaterSource({ farmId: 'farm-1', name: 'Well 1' })).error.code).toBe('duplicate');
  });
});

describe('updateWaterSource, setWaterSourceActive and deleteWaterSource', () => {
  it('changes the name, kind, fields and notes, and nothing else', async () => {
    const q = chain({ data: { id: 's1' }, error: null });
    from.mockReturnValue(q);
    await updateWaterSource('s1', { name: 'Well 2', notes: 'x' });
    expect(args(q, 'update')).toEqual([[{ name: 'Well 2', source_type: null, fields_served: null, notes: 'x' }]]);
    expect(args(q, 'eq')).toEqual([['id', 's1']]);
  });

  it('says a name that records use cannot be changed', async () => {
    from.mockReturnValue(chain({ data: null, error: { code: '23514', message: 'The water source "Well 1" is used by records and cannot be renamed.' } }));
    expect((await updateWaterSource('s1', { name: 'Well 2' })).error.code).toBe('in_use');
  });

  it('archives and restores, and refuses anything but a yes or no', async () => {
    const q = chain({ data: { id: 's1', is_active: false }, error: null });
    from.mockReturnValue(q);
    await setWaterSourceActive('s1', false);
    expect(args(q, 'update')).toEqual([[{ is_active: false }]]);
    expect((await setWaterSourceActive('s1', 'no')).error.code).toBe('invalid');
  });

  it('deletes, and says forbidden when nothing was deleted', async () => {
    from.mockReturnValueOnce(chain({ data: [{ id: 's1' }], error: null }));
    expect(await deleteWaterSource('s1')).toEqual({ data: null, error: null });
    from.mockReturnValueOnce(chain({ data: [], error: null }));
    expect((await deleteWaterSource('s1')).error.code).toBe('forbidden');
    from.mockReturnValueOnce(chain({ data: null, error: { code: '23514', message: 'used by records' } }));
    expect((await deleteWaterSource('s1')).error.code).toBe('in_use');
  });
});

describe('addWaterSources', () => {
  it('adds each one, with its kind and fields, and counts them', async () => {
    const queries = [];
    from.mockImplementation(() => { const q = chain({ data: null, error: null }); queries.push(q); return q; });
    const result = await addWaterSources('farm-1', [{ name: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1' }, { name: 'Canal' }]);
    expect(result).toEqual({ data: { added: 2, skipped: 0, remaining: 0 }, error: null });
    expect(args(queries[0], 'insert')).toEqual([[{ farm_id: 'farm-1', name: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1', notes: null }]]);
  });

  it('skips a repeat, a name that is not valid, and one that already exists, and goes on with the rest', async () => {
    let call = 0;
    from.mockImplementation(() => { call += 1; return chain(call === 1 ? { data: null, error: { code: '23505', message: 'dup' } } : { data: null, error: null }); });
    const result = await addWaterSources('farm-1', [{ name: 'Well 1' }, { name: 'well 1' }, { name: '' }, { name: 'x'.repeat(61) }, { name: 'Canal' }]);
    expect(result.data).toEqual({ added: 1, skipped: 4, remaining: 0 });
  });

  it('adds at most so many at once, and says how many are left', async () => {
    from.mockImplementation(() => chain({ data: null, error: null }));
    const entries = Array.from({ length: MAX_WATER_SOURCES_AT_ONCE + 3 }, (_, i) => ({ name: `Source ${i}` }));
    expect((await addWaterSources('farm-1', entries)).data).toEqual({ added: MAX_WATER_SOURCES_AT_ONCE, skipped: 0, remaining: 3 });
  });

  it('stops at once when the person may not add them, saying how many were added before', async () => {
    let call = 0;
    from.mockImplementation(() => { call += 1; return chain(call === 2 ? { data: null, error: { code: '42501', message: 'no' } } : { data: null, error: null }); });
    const result = await addWaterSources('farm-1', [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    expect(result.error).toMatchObject({ code: 'forbidden', added: 1 });
    expect(from).toHaveBeenCalledTimes(2);
  });
});
