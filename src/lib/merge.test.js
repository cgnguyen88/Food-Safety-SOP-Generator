import { describe, it, expect } from 'vitest';
import { mergeChanges } from './merge.js';

describe('mergeChanges (a list of items with ids, such as incidents)', () => {
  const base = [{ id: 'a', note: 'old' }, { id: 'b', note: 'keep' }, { id: 'c', note: 'c' }];

  it("keeps the other device's new item and this device's change", () => {
    const local = [{ id: 'a', note: 'edited here' }, { id: 'b', note: 'keep' }, { id: 'c', note: 'c' }];
    const server = [...base, { id: 'd', note: 'added on the phone' }];
    expect(mergeChanges(base, local, server)).toEqual([
      { id: 'a', note: 'edited here' }, { id: 'b', note: 'keep' }, { id: 'c', note: 'c' }, { id: 'd', note: 'added on the phone' },
    ]);
  });

  it("applies this device's additions and deletions on top of the other device's", () => {
    const local = [{ id: 'a', note: 'old' }, { id: 'c', note: 'c' }, { id: 'e', note: 'new here' }];
    const server = [{ id: 'a', note: 'old' }, { id: 'b', note: 'edited on the phone' }, { id: 'c', note: 'c' }];
    expect(mergeChanges(base, local, server)).toEqual([{ id: 'a', note: 'old' }, { id: 'c', note: 'c' }, { id: 'e', note: 'new here' }]);
  });

  it('keeps an item edited here even if the other device deleted it, so no edit is lost', () => {
    const local = [{ id: 'a', note: 'old' }, { id: 'b', note: 'edited here' }, { id: 'c', note: 'c' }];
    const server = [{ id: 'a', note: 'old' }, { id: 'c', note: 'c' }];
    expect(mergeChanges(base, local, server)).toEqual([{ id: 'a', note: 'old' }, { id: 'c', note: 'c' }, { id: 'b', note: 'edited here' }]);
  });

  it("lets the other device's change stand when this device did not touch the item", () => {
    const server = [{ id: 'a', note: 'phone' }, { id: 'b', note: 'keep' }, { id: 'c', note: 'c' }];
    expect(mergeChanges(base, base, server)).toEqual(server);
  });

  it('treats everything here as new when nothing was saved before', () => {
    expect(mergeChanges(undefined, [{ id: 'x' }], [{ id: 'y' }])).toEqual([{ id: 'y' }, { id: 'x' }]);
  });

  it('compares items without an id by their content', () => {
    expect(mergeChanges(['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'z'])).toEqual(['a', 'b', 'z', 'c']);
    expect(mergeChanges(['a', 'b'], ['b'], ['a', 'b'])).toEqual(['b']);
  });
});

describe('mergeChanges (an object such as the farm profile)', () => {
  it('takes the fields changed here and keeps the fields changed elsewhere', () => {
    const base = { farm_name: 'GV', crops: 'kale', phone: '1' };
    const local = { farm_name: 'Green Valley', crops: 'kale', phone: '1' };
    const server = { farm_name: 'GV', crops: 'kale, beets', phone: '1' };
    expect(mergeChanges(base, local, server)).toEqual({ farm_name: 'Green Valley', crops: 'kale, beets', phone: '1' });
  });

  it('removes a field removed here', () => {
    expect(mergeChanges({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 })).toEqual({ a: 1, c: 3 });
  });

  it('compares nested values by content', () => {
    expect(mergeChanges({ rates: { wage: 15 } }, { rates: { wage: 15 } }, { rates: { wage: 18 } })).toEqual({ rates: { wage: 18 } });
  });

  it('uses the value from here when the shapes do not match', () => {
    expect(mergeChanges({ a: 1 }, { a: 2 }, ['oops'])).toEqual({ a: 2 });
    expect(mergeChanges([], [1], null)).toEqual([1]);
  });

  it('does not change its inputs', () => {
    const base = [{ id: 'a' }];
    const local = [{ id: 'b' }];
    const server = [{ id: 'a' }];
    const frozen = JSON.stringify([base, local, server]);
    mergeChanges(base, local, server);
    expect(JSON.stringify([base, local, server])).toBe(frozen);
  });
});
