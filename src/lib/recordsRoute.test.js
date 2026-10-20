import { describe, it, expect } from 'vitest';
import { parseRecordsRoute, logRoute, viewRoute, ROUTES } from './recordsRoute.js';

describe('recordsRoute', () => {
  it('builds and parses every route type', () => {
    expect(parseRecordsRoute(ROUTES.overview)).toEqual({ type: 'overview' });
    expect(parseRecordsRoute(ROUTES.review)).toEqual({ type: 'review' });
    expect(parseRecordsRoute(ROUTES.history)).toEqual({ type: 'history' });
    expect(parseRecordsRoute(ROUTES.reports)).toEqual({ type: 'reports' });
    expect(parseRecordsRoute(ROUTES.fields)).toEqual({ type: 'fields' });
    expect(parseRecordsRoute(ROUTES.training)).toEqual({ type: 'training' });
    expect(parseRecordsRoute(ROUTES.trace)).toEqual({ type: 'trace' });
    expect(parseRecordsRoute(logRoute('sanitation_log'))).toEqual({ type: 'log', kind: 'sanitation_log' });
    expect(parseRecordsRoute(viewRoute('3f2a-91bc'))).toEqual({ type: 'view', viewId: '3f2a-91bc' });
  });

  it.each(['dashboard', 'records', 'recordGenerators', 'receipts', 'log:bogus', 'log:', 'view:', 'view:a b', 'view:../x', 'log:harvest:extra', 'recordStock', '', null, undefined, 5])(
    'does not treat %j as a records page',
    (page) => {
      expect(parseRecordsRoute(page)).toBeNull();
    },
  );

});
