import { useState, useEffect } from "react";
import { GLOBAL_CSS } from "./styles/global.js";
import { SOP_DATA } from "./data/sop-data.js";
import { DEFAULT_COST_SETTINGS } from "./data/cost-defaults.js";
import { loadFromStorage, saveToStorage } from "./utils/storage.js";
import { decodeShareLink } from "./utils/export.js";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import SOPEditor from "./components/SOPEditor.jsx";
import FarmProfileModal from "./components/FarmProfileModal.jsx";
import ViolationDashboard from "./components/ViolationDashboard.jsx";
import EconomicReport from "./components/EconomicReport.jsx";

export default function App() {
  const [activeSOP, setActiveSOP] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [showProfile, setShowProfile] = useState(false);
  const [farmProfile, setFarmProfile] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [costSettings, setCostSettings] = useState(DEFAULT_COST_SETTINGS);

  // Load all persisted data on mount
  useEffect(() => {
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
      <style>{GLOBAL_CSS}</style>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
      <div style={{ height:"100vh",display:"flex",overflow:"hidden" }}>
        <Sidebar
          activeSOP={activeSOP}
          activePage={activePage}
          onSelectSOP={handleSelectSOP}
          onOpenProfile={() => setShowProfile(true)}
          onNavigate={handleNavigate}
          farmProfile={farmProfile}
          incidents={incidents}
        />
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"var(--cream)" }}>
          {activePage === "sop" && activeSOP ? (
            <SOPEditor sop={activeSOP} farmProfile={farmProfile} onBack={() => handleNavigate("home")} />
          ) : activePage === "violations" ? (
            <ViolationDashboard
              incidents={incidents}
              onAddIncident={addIncident}
              onUpdateIncident={updateIncident}
              onDeleteIncident={deleteIncident}
            />
          ) : activePage === "economic" ? (
            <EconomicReport
              incidents={incidents}
              costSettings={costSettings}
              onSaveCostSettings={saveCostSettings}
            />
          ) : (
            <Dashboard
              farmProfile={farmProfile}
              onSelectSOP={handleSelectSOP}
              onOpenProfile={() => setShowProfile(true)}
            />
          )}
        </div>
      </div>
      {showProfile && <FarmProfileModal profile={farmProfile} onSave={saveFarmProfile} onClose={() => setShowProfile(false)} />}
    </>
  );
}
