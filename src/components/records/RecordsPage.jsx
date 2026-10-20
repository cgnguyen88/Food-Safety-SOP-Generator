import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { recordsText } from './text.js';
import * as ui from './ui.js';
import ChangeHistory from './ChangeHistory.jsx';
import RecordsProviders from './RecordsProviders.jsx';
import FieldsPage from './FieldsPage.jsx';
import NeedsReview from './NeedsReview.jsx';
import RecordLog from './RecordLog.jsx';
import RecordsOverview from './RecordsOverview.jsx';
import ReportsPage from './ReportsPage.jsx';
import { canSeeKind } from '../../domain/records/workflow.js';
import SavedViewResults from './SavedViewResults.jsx';
import TracePage from './TracePage.jsx';
import TrainingDuePage from './TrainingDuePage.jsx';
import WaterAssessmentsPage from './WaterAssessmentsPage.jsx';

/**
 * Renders whichever records screen the route names. Without a farm (sign-up
 * provisioning not finished, or the database not set up) it explains and offers a retry
 * instead of failing silently.
 */
export default function RecordsPage({ route, farm, role, userId, operation, lotCodeFormat, savedViews = [], metaReady = true, needsReviewCount = 0, onNavigate, onChanged, onRetryFarm }) {
  const { lang } = useLanguage();
  const tt = recordsText(lang);

  if (!farm) {
    return (
      <div style={ui.page}>
        <div style={{ ...ui.card, padding: '36px 24px', textAlign: 'center' }}>
          <h1 style={{ ...ui.h1, fontSize: 20 }}>{tt.setup.title}</h1>
          <p style={{ ...ui.subtitle, margin: '0 0 18px' }}>{tt.setup.body}</p>
          <button type="button" onClick={onRetryFarm} style={ui.buttonPrimary}>{tt.setup.retry}</button>
        </div>
      </div>
    );
  }

  // The operation's details (name, owner, food safety manager, auditor...) come from the farm profile,
  // which the whole team shares.
  const reportOperation = operation;
  const shared = { farm, role, userId, operation: reportOperation, needsReviewCount, onChanged, onNavigate };
  const screenFor = () => {
    switch (route.type) {
      case 'review':
        return <NeedsReview {...shared} />;
      case 'log':
        if (!canSeeKind(route.kind, role)) {
          return <div style={ui.page}><div style={{ ...ui.card, padding: 32, textAlign: 'center', color: '#64748b' }}>{tt.log.notAllowed}</div></div>;
        }
        return <RecordLog key={route.kind} kind={route.kind} {...shared} />;
      case 'history':
        return <ChangeHistory farm={farm} />;
      case 'reports':
        return <ReportsPage farm={farm} role={role} operation={reportOperation} needsReviewCount={needsReviewCount} onNavigate={onNavigate} />;
      case 'fields':
        return <FieldsPage farm={farm} role={role} />;
      case 'training':
        return <TrainingDuePage farm={farm} role={role} onChanged={onChanged} />;
      case 'trace':
        return <TracePage farm={farm} role={role} />;
      case 'water':
        return <WaterAssessmentsPage farm={farm} role={role} onChanged={onChanged} />;
      case 'view': {
        const view = savedViews.find((v) => v.id === route.viewId);
        if (view) return <SavedViewResults key={view.id} view={view} {...shared} />;
        if (!metaReady) return null; // the farm's views are still loading: not "missing" yet
        return <div style={ui.page}><div style={{ ...ui.card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{tt.views.notFound}</div></div>;
      }
      default:
        return <RecordsOverview farm={farm} role={role} savedViews={savedViews} needsReviewCount={needsReviewCount} onNavigate={onNavigate} onChanged={onChanged} />;
    }
  };

  // One field list for the whole records area: the forms, a record's detail and the Fields page all share it.
  return <RecordsProviders farm={farm} lotCodeFormat={lotCodeFormat}>{screenFor()}</RecordsProviders>;
}
