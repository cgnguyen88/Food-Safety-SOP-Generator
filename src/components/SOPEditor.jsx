import { useState, useEffect } from "react";
import ChatPanel from "./ChatPanel.jsx";
import FormPanel from "./FormPanel.jsx";
import ExportModal from "./ExportModal.jsx";
import ReviewPanel from "./ReviewPanel.jsx";
import SOPRecordModal from "./SOPRecordModal.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

function buildProfilePrefill(sop, farmProfile) {
  if (!farmProfile) return {};

  const prefill = {};

  // Explicit cross-field mappings used by many SOP templates
  if (farmProfile.farm_name) prefill.farm_name = farmProfile.farm_name;
  if (farmProfile.owner_name) prefill.prepared_by = farmProfile.owner_name;
  if (farmProfile.food_safety_manager) prefill.food_safety_manager = farmProfile.food_safety_manager;
  if (farmProfile.farm_director) prefill.reviewed_by = farmProfile.farm_director;
  if (farmProfile.owner_name) prefill.owner_name = farmProfile.owner_name;
  if (farmProfile.phone) prefill.phone = farmProfile.phone;
  if (farmProfile.email) prefill.email = farmProfile.email;
  if (farmProfile.address) prefill.address = farmProfile.address;

  // Direct ID mapping when profile keys match SOP field IDs
  sop.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!prefill[field.id] && farmProfile[field.id]) {
        prefill[field.id] = farmProfile[field.id];
      }
    });
  });

  return prefill;
}

export default function SOPEditor({ sop, farmProfile, onBack }) {
  const { lang } = useLanguage();
  const e = T[lang].editor;
  const localizedSop = getLocalizedSop(sop, lang);

  const [formData, setFormData] = useState(() => ({
    ...buildProfilePrefill(sop, farmProfile),
    ...(sop.prefillData || {}),
  }));
  const [missingFields, setMissingFields] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showRecords, setShowRecords] = useState(false);

  // Clear review state when SOP changes
  useEffect(() => {
    setMissingFields([]);
    setShowReview(false);
  }, [sop.id]);

  // Rehydrate when profile or selected SOP changes, without overwriting user's manual edits.
  useEffect(() => {
    const profilePrefill = buildProfilePrefill(sop, farmProfile);
    const sharedPrefill = sop.prefillData || {};
    setFormData((prev) => {
      const next = { ...prev };
      const merged = { ...profilePrefill, ...sharedPrefill };
      Object.entries(merged).forEach(([key, value]) => {
        const current = next[key];
        const hasCurrent = Array.isArray(current) ? current.length > 0 : !!current;
        if (!hasCurrent) {
          next[key] = value;
        }
      });
      return next;
    });
  }, [sop, farmProfile]);

  const handleChange = (id, val) => {
    setFormData(p => ({ ...p, [id]: val }));
    setMissingFields(prev => prev.filter(f => f !== id));
  };
  const handleFormUpdate = (updates) => setFormData(p => ({ ...p, ...updates }));

  const handleReview = () => {
    const required = sop.sections.flatMap(s => s.fields.filter(f => f.required).map(f => f.id));
    const missing = required.filter(id => {
      const val = formData[id];
      if (Array.isArray(val)) return val.length === 0;
      return !val;
    });
    setMissingFields(missing);
    setShowReview(true);
    // Scroll to first missing field
    if (missing.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`field-${missing[0]}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  };

  const completionPct = () => {
    const all = sop.sections.flatMap(s => s.fields);
    const filled = all.filter(f => {
      const val = formData[f.id];
      if (Array.isArray(val)) return val.length > 0;
      return !!val;
    });
    return Math.round((filled.length / all.length) * 100);
  };
  const completion = completionPct();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--cream)", position: "relative" }}>
      {/* Top Bar with Glass effect */}
      <div className="glass" style={{
        padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 20, borderBottom: "1px solid var(--glass-bdr)", borderLeft: "none", borderRight: "none", borderTop: "none",
        borderRadius: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button onClick={onBack} style={{ padding: "10px 18px", border: "1.5px solid var(--u-navy)", borderRadius: 12, background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--u-navy)" }}>{e.back}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>{sop.icon}</span>
            <div>
              <h2 style={{ fontSize: 22, color: "var(--u-navy)", fontFamily: "Lora,serif" }}>{localizedSop.title}</h2>
              <div style={{ fontSize: 12, color: "var(--txt3)", fontWeight: 500, letterSpacing: 0.5 }}>{sop.code} {sop.standard}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--txt3)", marginBottom: 4, letterSpacing: 1 }}>{e.completion}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 120, height: 8, background: "var(--cream2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${completion}%`, height: "100%", background: "var(--u-navy)", transition: "width .4s ease" }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--u-navy)", minWidth: 40 }}>{completion}%</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setShowRecords(true)} style={{ padding: "12px 24px", background: "linear-gradient(135deg,var(--u-sky),var(--u-navy-l))", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 6px 14px rgba(0,69,128,0.3)" }}>
              {e.recordsGenerator}
            </button>
            <button onClick={handleReview} style={{ padding: "12px 24px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 12px rgba(253,189,16,0.3)" }}>{e.review}</button>
            <button onClick={() => setShowExport(true)} style={{ padding: "12px 24px", background: "var(--u-navy)", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 12px rgba(0,45,84,0.3)" }}>{e.export}</button>
          </div>
        </div>
      </div>

      {/* Main split layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }} className="no-print">
        <ChatPanel sop={sop} formData={formData} onFormUpdate={handleFormUpdate} farmProfile={farmProfile} />
        <FormPanel sop={sop} formData={formData} onChange={handleChange} missingFields={missingFields} farmProfile={farmProfile} />
        {showReview && <ReviewPanel sop={sop} missingFields={missingFields} onClose={() => setShowReview(false)} />}
      </div>

      {/* Print view */}
      <div className="print-content" style={{ display: "none" }}>
        <h1 style={{ fontFamily: "Lora,serif", fontSize: 24, color: "var(--u-navy)", borderBottom: "2px solid var(--u-navy)", paddingBottom: 8, marginBottom: 16 }}>
          {farmProfile?.farm_name ? `${farmProfile.farm_name} — ` : ""}{sop.title}
        </h1>
        {sop.sections.map(s => (
          <div key={s.id} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, color: "var(--u-navy)", marginBottom: 12 }}>{s.title}</h2>
            {s.fields.map(f => (
              <div key={f.id} style={{ marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>{f.label}: </strong>
                <span style={{ fontSize: 13 }}>{Array.isArray(formData[f.id]) ? formData[f.id].join(", ") : (formData[f.id] || "___________________________")}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showExport && <ExportModal sop={sop} formData={formData} farmProfile={farmProfile} onClose={() => setShowExport(false)} />}
      {showRecords && <SOPRecordModal sop={sop} formData={formData} farmProfile={farmProfile} onClose={() => setShowRecords(false)} />}
    </div>
  );
}
