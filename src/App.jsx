import { useState, useEffect } from "react";
import { GLOBAL_CSS } from "./styles/global.js";
import { SOP_DATA } from "./data/sop-data.js";
import { DEFAULT_COST_SETTINGS } from "./data/cost-defaults.js";
import { loadFromStorage, saveToStorage } from "./utils/storage.js";
import { decodeShareLink } from "./utils/export.js";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import SOPEditor from "./components/SOPEditor.jsx";
import FarmProfileModal from "./components/FarmProfileModal.jsx";
import ViolationDashboard from "./components/ViolationDashboard.jsx";
import EconomicReport from "./components/EconomicReport.jsx";
import ExpandableChat from "./components/ExpandableChat.jsx";
import PlanGenerator from "./components/PlanGenerator.jsx";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeSOP, setActiveSOP] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [showProfile, setShowProfile] = useState(false);
  const [farmProfile, setFarmProfile] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [costSettings, setCostSettings] = useState(DEFAULT_COST_SETTINGS);

  // Load all persisted data on mount
  useEffect(() => {
    const savedUser = loadFromStorage("current_user");
    setCurrentUser(savedUser);
    setAuthReady(true);
    setFarmProfile(loadFromStorage("farm_profile"));
    setIncidents(loadFromStorage("incidents", []));
    setCostSettings(loadFromStorage("cost_settings", DEFAULT_COST_SETTINGS));

    // Handle share link
    const shared = decodeShareLink();
    if (shared) {
      const sop = SOP_DATA.find(s => s.id === shared.sopId);
      if (sop) { setActiveSOP({ ...sop, prefillData: shared.formData }); setActivePage("sop"); }
    }
  }, []);

  const saveFarmProfile = (profile) => {
    setFarmProfile(profile);
    saveToStorage("farm_profile", profile);
    setShowProfile(false);
  };

  const addIncident = (inc) => {
    const updated = [...incidents, inc];
    setIncidents(updated);
    saveToStorage("incidents", updated);
  };

  const updateIncident = (id, data) => {
    const updated = incidents.map(i => i.id === id ? { ...i, ...data } : i);
    setIncidents(updated);
    saveToStorage("incidents", updated);
  };

  const deleteIncident = (id) => {
    const updated = incidents.filter(i => i.id !== id);
    setIncidents(updated);
    saveToStorage("incidents", updated);
  };

  const saveCostSettings = (settings) => {
    setCostSettings(settings);
    saveToStorage("cost_settings", settings);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    saveToStorage("current_user", null);
    setCurrentUser(null);
  };

  const handleSelectSOP = (sop) => {
    setActiveSOP(sop);
    setActivePage(sop ? "sop" : "home");
  };

  const handleNavigate = (page) => {
    setActivePage(page);
    if (page !== "sop") setActiveSOP(null);
  };

  if (!authReady) return null;

  if (!currentUser) {
    return (
      <LanguageProvider>
        <style>{GLOBAL_CSS}</style>
        <AuthScreen onLogin={handleLogin} />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <style>{GLOBAL_CSS}</style>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}@keyframes caretBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <div style={{ height: "100vh", display: "flex", overflow: "hidden" }}>
        <Sidebar
          activeSOP={activeSOP}
          activePage={activePage}
          onSelectSOP={handleSelectSOP}
          onOpenProfile={() => setShowProfile(true)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentUser={currentUser}
          farmProfile={farmProfile}
          incidents={incidents}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--cream)" }}>
          {activePage === "sop" && activeSOP ? (
            <SOPEditor sop={activeSOP} farmProfile={farmProfile} onBack={() => handleNavigate("home")} />
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
      <ExpandableChat farmProfile={farmProfile} incidents={incidents} />
    </LanguageProvider>
  );
}
