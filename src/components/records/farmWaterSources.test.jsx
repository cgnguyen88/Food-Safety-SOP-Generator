// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, screen, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('../../lib/waterSources.js', () => ({ listWaterSources: vi.fn() }));
const { listWaterSources } = await import('../../lib/waterSources.js');
const { useLoadWaterSources, useFarmWaterSources } = await import('./farmWaterSources.js');
const { default: FarmWaterSourcesProvider } = await import('./FarmWaterSourcesProvider.jsx');

const ok = (sources) => ({ data: sources, error: null });
const WELL = { id: 's-1', name: 'Well 1', is_active: true };

beforeEach(() => {
  listWaterSources.mockReset();
  listWaterSources.mockResolvedValue(ok([WELL]));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(cleanup);

describe('useLoadWaterSources', () => {
  it('starts loading, then has the farm’s water sources', async () => {
    const { result } = renderHook(() => useLoadWaterSources('farm-1'));
    expect(result.current).toMatchObject({ status: 'loading', sources: [] });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sources).toEqual([WELL]);
    expect(listWaterSources).toHaveBeenCalledWith('farm-1');
  });

  it('says why when they could not be read, and keeps the list it already had on a failed reload', async () => {
    const { result } = renderHook(() => useLoadWaterSources('farm-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    listWaterSources.mockResolvedValue({ data: null, error: { code: 'not_set_up' } });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorCode).toBe('not_set_up');
    expect(result.current.sources).toEqual([WELL]);
  });

  it('has nothing to read, and does not ask, when there is no farm yet', () => {
    const { result } = renderHook(() => useLoadWaterSources(undefined));
    expect(result.current).toMatchObject({ status: 'ready', sources: [] });
    expect(listWaterSources).not.toHaveBeenCalled();
  });
});

describe('FarmWaterSourcesProvider', () => {
  const Names = () => {
    const { status, sources } = useFarmWaterSources();
    return <p>{status}: {sources.map((s) => s.name).join(', ')}</p>;
  };

  it('shares one reading of the list with everything below it', async () => {
    render(<FarmWaterSourcesProvider farmId="farm-1"><Names /><Names /></FarmWaterSourcesProvider>);
    await waitFor(() => expect(screen.getAllByText('ready: Well 1')).toHaveLength(2));
    expect(listWaterSources).toHaveBeenCalledTimes(1);
  });

  it('gives an empty, ready list outside a provider, so forms work without one', () => {
    render(<Names />);
    expect(screen.getByText('ready:')).toBeTruthy();
  });
});
