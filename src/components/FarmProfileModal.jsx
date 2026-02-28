import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

const PROFILE_FIELDS = [
  { id: "farm_name", label: "Farm / Operation Name", ph: "Green Valley Farm" },
  { id: "owner_name", label: "Owner / Operator Name", ph: "Jane Smith" },
  { id: "food_safety_manager", label: "Food Safety Manager", ph: "John Doe — prepares and maintains all SOPs" },
  { id: "farm_director", label: "Farm Director (Verifier)", ph: "Jane Smith — reviews and approves SOPs" },
  { id: "address", label: "Farm Address", ph: "1234 Farm Road, City, State, ZIP" },
  { id: "phone", label: "Phone", ph: "(555) 123-4567" },
  { id: "email", label: "Email", ph: "owner@greenvallyfarm.com" },
  { id: "operation_type", label: "Operation Type", ph: "Mixed vegetable, ~15 acres, seasonal harvest crew", multi: true },
  { id: "crops", label: "Primary Crops Grown", ph: "Leafy greens, tomatoes, cucumbers, herbs", multi: true },
  { id: "certifier", label: "Certifier / Auditor", ph: "Oregon Tilth / PrimusGFS / Self-audit" },
  { id: "fsma_status", label: "FSMA Coverage Status", ph: "Covered farm (>$25K avg annual sales)" },

  // Master Template Expansion
  { id: "hw_station_locations", label: "Handwashing Station Locations", ph: "Near field entrance, packing shed, restroom facilities", multi: true },
  { id: "hw_supplies", label: "Standard Handwashing Supplies", ph: "Liquid soap, single-use paper towels, potable water" },
  { id: "toilet_location", label: "Toilet Facility Locations", ph: "Portable units near Block A & B; permanent in shed", multi: true },
  { id: "water_source", label: "Primary Water Source(s)", ph: "Municipal water for packing; certified well for irrigation" },
  { id: "training_provider", label: "Standard Training Provider", ph: "Farm Manager / PSA-trained staff" },
  { id: "training_language", label: "Training Language(s)", ph: "English, Spanish" },
  { id: "training_record_location", label: "Where Records are Kept", ph: "Binder in farm office / office computer" },

  { id: "notes", label: "Additional AI Context", ph: "Any relevant detail to help AI generate better suggestions", multi: true },
];

export default function FarmProfileModal({ profile, onSave, onClose }) {
  const { lang } = useLanguage();
  const fp = T[lang].farmProfile;
  const [form, setForm] = useState(profile || {});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "var(--cream)", borderRadius: 16, width: "min(600px,95vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--bdr2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontFamily: "Lora,serif", fontSize: 22, color: "var(--g900)" }}>{fp.title}</h2>
              <p style={{ fontSize: 13, color: "var(--txt2)", marginTop: 4 }}>{fp.subtitle}</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--txt3)", lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "24px 32px" }}>
          {PROFILE_FIELDS.map(f => (
            <div key={f.id} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--txt2)", marginBottom: 6 }}>{fp.fields[f.id] || f.label}</label>
              {f.multi ? (
                <textarea value={form[f.id] || ""} onChange={e => set(f.id, e.target.value)} placeholder={f.ph}
                  style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--bdr)", borderRadius: 8, fontSize: 13, resize: "vertical", minHeight: 64, background: "white", outline: "none" }} />
              ) : (
                <input type="text" value={form[f.id] || ""} onChange={e => set(f.id, e.target.value)} placeholder={f.ph}
                  style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--bdr)", borderRadius: 8, fontSize: 13, background: "white", outline: "none" }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--bdr2)", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1.5px solid var(--bdr)", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>{fp.cancel}</button>
          <button onClick={() => onSave(form)} style={{ padding: "9px 24px", background: "var(--g800)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{fp.save}</button>
        </div>
      </div>
    </div>
  );
}
