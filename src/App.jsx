import { useState, useEffect } from "react";
import { GLOBAL_CSS } from "./styles/global.js";
import { SOP_DATA } from "./data/sop-data.js";
import { decodeShareLink } from "./utils/export.js";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import useFarmAccount from "./lib/useFarmAccount.js";
import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import SOPEditor from "./components/SOPEditor.jsx";
import FarmProfileModal from "./components/FarmProfileModal.jsx";
import ViolationDashboard from "./components/ViolationDashboard.jsx";
import EconomicReport from "./components/EconomicReport.jsx";
import ExpandableChat from "./components/ExpandableChat.jsx";
import PlanGenerator from "./components/PlanGenerator.jsx";
import { AccountMessage, ImportNotice, ImportOffer, MergedNotice, SaveIndicator } from "./components/AccountStatus.jsx";
import RecordsPage from "./components/records/RecordsPage.jsx";
import useRecordsMeta from "./components/records/useRecordsMeta.js";
import { parseRecordsRoute } from "./lib/recordsRoute.js";
import { operationFromFarmProfile } from "./domain/records/report.js";

const KEYFRAMES = `@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}@keyframes caretBlink{0%,100%{opacity:1}50%{opacity:0}}`;

export default function App() {
  return (
    <LanguageProvider>
      <style>{GLOBAL_CSS}</style>
      <style>{KEYFRAMES}</style>
      <FarmApp />
    </LanguageProvider>
  );
}

function FarmApp() {
  const { lang } = useLanguage();
  const farm = useFarmAccount();
  const recordsMeta = useRecordsMeta({ farm: farm.account?.farm ?? null, userId: farm.account?.user.id });
  const [activeSOP, setActiveSOP] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [showProfile, setShowProfile] = useState(false);

  // A shared SOP link opens that SOP, prefilled, once the person is signed in.
  useEffect(() => {
    const shared = decodeShareLink();
    if (!shared) return;
    const sop = SOP_DATA.find(s => s.id === shared.sopId);
    if (sop) { setActiveSOP({ ...sop, prefillData: shared.formData }); setActivePage("sop"); }
  }, []);

  if (farm.status === "checking") return null;
  if (farm.status === "signed-out") return <AuthScreen />;
  if (farm.status === "loading") return <AccountMessage kind="loading" />;
  if (farm.status === "error") {
    return <AccountMessage kind="error" message={farm.error} onRetry={farm.retryLoad} onSignOut={() => farm.signOut()} />;
  }

  const { farm_profile: farmProfile, incidents, cost_settings: costSettings, sop_activity_records: activityRecords } = farm.data;
  const recordsRoute = parseRecordsRoute(activePage);

  const saveFarmProfile = (profile) => {
    farm.setValue("farm_profile", profile);
    setShowProfile(false);
  };
  // Each change is built on the latest list, so quick changes in a row all count.
  const addIncident = (inc) => farm.setValue("incidents", list => [...list, inc]);
  const updateIncident = (id, changes) => farm.setValue("incidents", list => list.map(i => (i.id === id ? { ...i, ...changes } : i)));
  const deleteIncident = (id) => farm.setValue("incidents", list => list.filter(i => i.id !== id));
  const saveCostSettings = (settings) => farm.setValue("cost_settings", settings);
  const saveActivityRecords = (records) => farm.setValue("sop_activity_records", records);

  const handleLogout = () => {
    const question = lang === "en"
      ? "Some changes could not be saved yet. Sign out anyway and lose them?"
      : "Algunos cambios aún no se pudieron guardar. ¿Cerrar sesión de todos modos y perderlos?";
    farm.signOut({ confirmUnsaved: () => window.confirm(question) });
  };

  const handleSelectSOP = (sop) => {
    setActiveSOP(sop);
    setActivePage(sop ? "sop" : "home");
  };

  const handleNavigate = (page) => {
    setActivePage(page);
    if (page !== "sop") setActiveSOP(null);
  };

  return (
    <>
      <div style={{ height: "100vh", display: "flex", overflow: "hidden" }}>
        <Sidebar
          activeSOP={activeSOP}
          activePage={activePage}
          onSelectSOP={handleSelectSOP}
          onOpenProfile={() => setShowProfile(true)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentUser={farm.account.user}
          farmProfile={farmProfile}
          incidents={incidents}
          records={{ role: recordsMeta.role ?? farm.account.role, needsReviewCount: recordsMeta.needsReviewCount, savedViews: recordsMeta.savedViews }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--cream)" }}>
          <ImportOffer offer={farm.importOffer} farmName={farm.account.farm?.name} onAccept={farm.acceptImport} onDecline={farm.declineImport} />
          <ImportNotice result={farm.importResult} onDismiss={farm.dismissImport} />
          <MergedNotice show={farm.mergedNotice} onDismiss={farm.dismissMerged} />
          {recordsRoute ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <RecordsPage
                route={recordsRoute}
                farm={farm.account.farm}
                role={recordsMeta.role ?? farm.account.role}
                userId={farm.account.user.id}
                operation={operationFromFarmProfile(farmProfile)}
                lotCodeFormat={farmProfile?.lot_code_format}
                savedViews={recordsMeta.savedViews}
                metaReady={recordsMeta.ready}
                needsReviewCount={recordsMeta.needsReviewCount}
                onNavigate={handleNavigate}
                onChanged={recordsMeta.refresh}
                onRetryFarm={farm.retryLoad}
              />
            </div>
          ) : activePage === "sop" && activeSOP ? (
            <SOPEditor
              sop={activeSOP}
              farmProfile={farmProfile}
              activityRecords={activityRecords}
              onSaveActivityRecords={saveActivityRecords}
              onBack={() => handleNavigate("home")}
            />
          ) : activePage === "violations" ? (
            <ViolationDashboard
              incidents={incidents}
              onAddIncident={addIncident}
              onUpdateIncident={updateIncident}
              onDeleteIncident={deleteIncident}
              costSettings={costSettings}
            />
          ) : activePage === "economic" ? (
            <EconomicReport
              incidents={incidents}
              costSettings={costSettings}
              onSaveCostSettings={saveCostSettings}
            />
          ) : activePage === "plan_generator" ? (
            <PlanGenerator
              farmProfile={farmProfile}
              onBack={() => handleNavigate("home")}
            />
          ) : (
            <Dashboard
              farmProfile={farmProfile}
              onSelectSOP={handleSelectSOP}
              onOpenProfile={() => setShowProfile(true)}
              onNavigate={handleNavigate}
            />
          )}
        </div>
      </div>
      {showProfile && <FarmProfileModal profile={farmProfile} onSave={saveFarmProfile} onClose={() => setShowProfile(false)} />}
      <ExpandableChat farmProfile={farmProfile} incidents={incidents} defaultOpen={farm.justSignedIn} />
      <SaveIndicator status={farm.saveStatus} onRetry={farm.retrySaves} />
    </>
  );
}
