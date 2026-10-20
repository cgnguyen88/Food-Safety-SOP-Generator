// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useRememberedOpen from './useRememberedOpen.js';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('useRememberedOpen', () => {
  it('starts as the default says, open unless told otherwise', () => {
    expect(renderHook(() => useRememberedOpen('a')).result.current[0]).toBe(true);
    expect(renderHook(() => useRememberedOpen('b', false)).result.current[0]).toBe(false);
  });

  it('remembers the last choice for the next visit', () => {
    const first = renderHook(() => useRememberedOpen('a'));
    act(() => first.result.current[1](false));
    expect(first.result.current[0]).toBe(false);
    first.unmount();
    expect(renderHook(() => useRememberedOpen('a')).result.current[0]).toBe(false);
  });

  it('keeps each section’s choice apart', () => {
    const first = renderHook(() => useRememberedOpen('a'));
    act(() => first.result.current[1](false));
    expect(renderHook(() => useRememberedOpen('b')).result.current[0]).toBe(true);
  });

  it('ignores a stored value that is not a yes or no, or is not even readable', () => {
    localStorage.setItem('a', JSON.stringify({ evil: true }));
    expect(renderHook(() => useRememberedOpen('a')).result.current[0]).toBe(true);
    localStorage.setItem('b', '{not json');
    expect(renderHook(() => useRememberedOpen('b', false)).result.current[0]).toBe(false);
  });

  it('still opens and closes when the browser will not store anything', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      const { result } = renderHook(() => useRememberedOpen('a'));
      act(() => result.current[1](false));
      expect(result.current[0]).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('still starts from the default when the browser will not let it read', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try {
      expect(renderHook(() => useRememberedOpen('a', false)).result.current[0]).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
