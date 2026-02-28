import { useState } from "react";
import { getFieldSuggestion } from "../utils/api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

export default function FormPanel({ sop, formData, onChange, missingFields, farmProfile }) {
  const { lang } = useLanguage();
  const f = T[lang].form;
  const localizedSop = getLocalizedSop(sop, lang);

  const [openSection, setOpenSection] = useState(sop.sections[0]?.id);
  const [loadingField, setLoadingField] = useState(null);

  const inputStyle = (id) => ({
    width: "100%", padding: "10px 14px", border: `1.5px solid ${missingFields?.includes(id) ? "var(--red)" : "var(--bdr)"}`,
    borderRadius: 10, fontSize: 15, background: "white", outline: "none", resize: "vertical",
    fontFamily: "inherit", transition: "all .2s",
  });

  const handleAISuggest = async (field) => {
    setLoadingField(field.id);
    const suggestion = await getFieldSuggestion(field, sop, formData, farmProfile);
    if (suggestion) onChange(field.id, suggestion);
    setLoadingField(null);
  };

  const renderCheckboxMultiple = (field) => {
    const current = Array.isArray(formData[field.id]) ? formData[field.id] : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
        {field.checkboxOptions.map(option => (
          <label key={option} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 15, color: "var(--txt)", lineHeight: 1.6 }}>
            <input
              type="checkbox"
              checked={current.includes(option)}
              onChange={(e) => {
                const updated = e.target.checked
                  ? [...current, option]
                  : current.filter(v => v !== option);
                onChange(field.id, updated);
              }}
              style={{ marginTop: 5, accentColor: "var(--u-blue)", width: 18, height: 18 }}
            />
            <span>{option}</span>
          </label>
        ))}
        <input
          type="text"
          placeholder={f.otherSpecify}
          style={{ ...inputStyle(field.id), marginTop: 4, height: 34, fontSize: 12 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              onChange(field.id, [...current, e.target.value.trim()]);
              e.target.value = "";
            }
          }}
        />
      </div>
    );
  };

  const canAISuggest = (field) => {
    return field.type === "text" || field.type === "textarea";
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
      {localizedSop.sections.map(section => (
        <div key={section.id} className="glass" style={{ marginBottom: 20, borderRadius: 20, overflow: "hidden" }}>
          <button onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: openSection === section.id ? "rgba(0,45,84,0.05)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontWeight: 700, fontSize: 17, color: openSection === section.id ? "var(--u-navy)" : "var(--txt)" }}>{section.title}</span>
            <span style={{ fontSize: 20, color: "var(--u-navy)", transform: openSection === section.id ? "rotate(180deg)" : "", transition: "transform .2s" }}>⌄</span>
          </button>
          {openSection === section.id && (
            <div style={{ padding: "16px 18px 20px", borderTop: "1px solid var(--bdr2)" }}>
              {section.fields.map(field => (
                <div key={field.id} id={`field-${field.id}`} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 15, fontWeight: 600, color: "var(--txt2)" }}>
                      {field.label}
                      {field.required && <span style={{ color: "var(--red)", fontSize: 14 }}>*</span>}
                      {missingFields?.includes(field.id) && <span style={{ fontSize: 12, color: "var(--red)", marginLeft: 6 }}>{f.required}</span>}
                    </label>
                    {canAISuggest(field) && (
                      <button
                        onClick={() => handleAISuggest(field)}
                        disabled={loadingField === field.id}
                        style={{
                          padding: "6px 16px", fontSize: 13, border: "none", borderRadius: 24,
                          background: loadingField === field.id ? "var(--g100)" : "var(--u-navy)",
                          color: "white", cursor: loadingField === field.id ? "wait" : "pointer", fontWeight: 700,
                          opacity: loadingField === field.id ? 0.7 : 1, transition: "all .2s",
                          boxShadow: "0 3px 8px rgba(0,45,84,0.2)"
                        }}
                      >
                        {loadingField === field.id ? f.working : f.aiSuggest}
                      </button>
                    )}
                  </div>
                  {field.type === "checkbox-multiple" ? (
                    renderCheckboxMultiple(field)
                  ) : field.type === "textarea" ? (
                    <textarea value={formData[field.id] || ""} onChange={e => onChange(field.id, e.target.value)}
                      placeholder={field.ph || ""} rows={3} style={inputStyle(field.id)} />
                  ) : field.type === "select" ? (
                    <select value={formData[field.id] || ""} onChange={e => onChange(field.id, e.target.value)} style={{ ...inputStyle(field.id), height: 38 }}>
                      <option value="">{f.selectOption}</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.type || "text"} value={formData[field.id] || ""} onChange={e => onChange(field.id, e.target.value)}
                      placeholder={field.ph || ""} style={{ ...inputStyle(field.id), height: 38 }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: 24, padding: "24px", border: "1.5px solid var(--bdr2)", borderRadius: 14, background: "var(--g50)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--u-navy)", marginBottom: 14 }}>{localizedSop.log.title}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{localizedSop.log.cols.map(col => <th key={col} style={{ background: "var(--u-navy)", color: "white", padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap", fontWeight: 600 }}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map(i => (
                <tr key={i}>
                  {localizedSop.log.cols.map((_, j) => (
                    <td key={j} style={{
                      border: "1px solid var(--bdr2)",
                      padding: "12px",
                      background: i % 2 === 0 ? "white" : "rgba(255,255,255,.5)",
                      color: "var(--txt)",
                      minHeight: "40px"
                    }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 13, color: "var(--txt3)", marginTop: 12 }}>{f.logPreview}</p>
      </div>
    </div>
  );
}
