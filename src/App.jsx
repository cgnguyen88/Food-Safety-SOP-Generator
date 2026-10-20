import { useState, useEffect } from "react";
import { GLOBAL_CSS } from "./styles/global.js";
import { SOP_DATA } from "./data/sop-data.js";
import { decodeShareLink } from "./utils/export.js";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import useFarmAccount from "./lib/useFarmAccount.js";
import AuthScreen from "./components/AuthScreen.jsx";
import AppShell from "./components/AppShell.jsx";
import Home from "./components/Home.jsx";
import SopLibrary from "./components/SopLibrary.jsx";
import SOPEditor from "./components/SOPEditor.jsx";
import FarmProfileModal from "./components/FarmProfileModal.jsx";
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

  const { farm_profile: farmProfile } = farm.data;
  // Owners and managers save the farm's SOPs; crew can read and fill them in, but what they type stays on their screen.
  const canSaveSops = ["owner", "manager"].includes(recordsMeta.role ?? farm.account.role);
  const recordsRoute = parseRecordsRoute(activePage);

  const saveFarmProfile = (profile) => {
    farm.setValue("farm_profile", profile);
    setShowProfile(false);
  };
  const handleLogout = () => {
    const question = lang === "en"
      ? "Some changes could not be saved yet. Sign out anyway and lose them?"
      : "Algunos cambios aún no se pudieron guardar. ¿Cerrar sesión de todos modos y perderlos?";
    farm.signOut({ confirmUnsaved: () => window.confirm(question) });
  };

  const handleSelectSOP = (sop) => {
    setActiveSOP(sop);
    setActivePage(sop ? "sop" : "sops");
  };

  const handleNavigate = (page) => {
    setActivePage(page);
    if (page !== "sop") setActiveSOP(null);
  };

  return (
    <>
      <AppShell
        activePage={activePage}
        onNavigate={handleNavigate}
        sidebar={{
          onOpenProfile: () => setShowProfile(true),
          onLogout: handleLogout,
          currentUser: farm.account.user,
          farmProfile,
          needsReviewCount: recordsMeta.needsReviewCount,
        }}
      >
        <div className="page-bleed">
          <ImportOffer offer={farm.importOffer} farmName={farm.account.farm?.name} onAccept={farm.acceptImport} onDecline={farm.declineImport} />
          <ImportNotice result={farm.importResult} onDismiss={farm.dismissImport} />
          <MergedNotice show={farm.mergedNotice} onDismiss={farm.dismissMerged} />
        </div>
        {recordsRoute ? (
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
        ) : activePage === "sop" && activeSOP ? (
          <SOPEditor
            key={activeSOP.id}
            sop={activeSOP}
            farmProfile={farmProfile}
            savedForm={farm.data.sop_forms?.[activeSOP.id]}
            onSaveForm={canSaveSops ? (form) => farm.setValue("sop_forms", (all) => ({ ...all, [activeSOP.id]: form })) : undefined}
            onBack={() => handleNavigate("sops")}
          />
        ) : activePage === "plan_generator" ? (
          <PlanGenerator farmProfile={farmProfile} onBack={() => handleNavigate("sops")} />
        ) : activePage === "sops" || !farm.account.farm ? (
          <SopLibrary onSelectSOP={handleSelectSOP} onOpenPlan={() => handleNavigate("plan_generator")} />
        ) : (
          <Home
            farm={farm.account.farm}
            farmProfile={farmProfile}
            role={recordsMeta.role ?? farm.account.role}
            lotCodeFormat={farmProfile?.lot_code_format}
            needsReviewCount={recordsMeta.needsReviewCount}
            onNavigate={handleNavigate}
            onOpenProfile={() => setShowProfile(true)}
            onChanged={recordsMeta.refresh}
          />
        )}
      </AppShell>
      {showProfile && <FarmProfileModal profile={farmProfile} onSave={saveFarmProfile} onClose={() => setShowProfile(false)} />}
      {/* A SOP has its own assistant beside the form, so the general one steps aside there. */}
      {!(activePage === "sop" && activeSOP) && <ExpandableChat farmProfile={farmProfile} defaultOpen={farm.justSignedIn} />}
      <SaveIndicator status={farm.saveStatus} onRetry={farm.retrySaves} />
    </>
  );
}
