import { useState, useEffect } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { VIOLATION_TYPES, SEVERITY_LEVELS } from "../data/cost-defaults.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

const today = () => new Date().toISOString().split("T")[0];

export default function IncidentLogForm({ incident, onSave, onClose }) {
  const { lang } = useLanguage();
  const iF = T[lang].incidentForm;
  const localizedSops = SOP_DATA.map(s => getLocalizedSop(s, lang));

  const [form, setForm] = useState(incident || {
    date: today(),
    sopId: "",
    sopName: "",
    violationType: "",
    severity: "medium",
    description: "",
    affectedProduct: "",
    downtimeHours: 0,
    correctiveAction: "",
    resolved: false,
    resolvedDate: "",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const availableViolations = form.sopId ? (VIOLATION_TYPES[form.sopId] || []) : [];

  const handleSopChange = (sopId) => {
    const sop = SOP_DATA.find(s => s.id === Number(sopId));
    set("sopId", Number(sopId));
    set("sopName", sop ? sop.title : "");
    set("violationType", "");
  };

  const handleSubmit = () => {
    if (!form.date || !form.sopId || !form.description) return;
    onSave({
      ...form,
      id: form.id || crypto.randomUUID(),
      sopId: Number(form.sopId),
    });
  };

  const inputStyle = {
    width:"100%",padding:"8px 12px",border:"1.5px solid var(--bdr)",borderRadius:8,fontSize:13,background:"white",outline:"none",fontFamily:"'IBM Plex Sans',sans-serif",
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--cream)",borderRadius:16,width:"min(640px,95vw)",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"var(--shadow-lg)" }}>
        <div style={{ padding:"24px 32px 16px",borderBottom:"1px solid var(--bdr2)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <h2 style={{ fontFamily:"Lora,serif",fontSize:20,color:"var(--g900)" }}>{incident ? iF.titleEdit : iF.titleNew}</h2>
            <p style={{ fontSize:12,color:"var(--txt3)",marginTop:2 }}>{iF.subtitle}</p>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--txt3)" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto",padding:"20px 32px" }}>
          {/* Date */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.date} *</label>
            <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={{...inputStyle,height:38}} />
          </div>

          {/* SOP Category */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.sopCategory} *</label>
            <select value={form.sopId} onChange={e=>handleSopChange(e.target.value)} style={{...inputStyle,height:38}}>
              <option value="">{iF.selectSop}</option>
              {localizedSops.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
            </select>
          </div>

          {/* Violation Type */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.violationType} *</label>
            <select value={form.violationType} onChange={e=>set("violationType",e.target.value)} style={{...inputStyle,height:38}} disabled={!form.sopId}>
              <option value="">{iF.selectType}</option>
              {availableViolations.map(vt => <option key={vt} value={vt}>{vt}</option>)}
              <option value="Other">{iF.other}</option>
            </select>
          </div>

          {/* Severity */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:8 }}>{iF.severity} *</label>
            <div style={{ display:"flex",gap:8 }}>
              {Object.entries(SEVERITY_LEVELS).map(([key, { label, color, icon }]) => (
                <label key={key} style={{
                  flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 8px",
                  border:`2px solid ${form.severity===key ? color : "var(--bdr2)"}`,borderRadius:10,cursor:"pointer",
                  background: form.severity===key ? color+"15" : "white",transition:"all .15s",
                }}>
                  <input type="radio" name="severity" value={key} checked={form.severity===key}
                    onChange={e=>set("severity",e.target.value)} style={{ display:"none" }} />
                  <span style={{ fontSize:16 }}>{icon}</span>
                  <span style={{ fontSize:12,fontWeight:600,color: form.severity===key ? color : "var(--txt2)" }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.description} *</label>
            <textarea value={form.description} onChange={e=>set("description",e.target.value)}
              placeholder={iF.descPlaceholder}
              rows={3} style={{...inputStyle,resize:"vertical"}} />
          </div>

          {/* Two columns */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14 }}>
            <div>
              <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.affectedProduct}</label>
              <input type="text" value={form.affectedProduct} onChange={e=>set("affectedProduct",e.target.value)}
                placeholder={iF.affectedPlaceholder} style={{...inputStyle,height:38}} />
            </div>
            <div>
              <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.downtimeHours}</label>
              <input type="number" min="0" step="0.5" value={form.downtimeHours} onChange={e=>set("downtimeHours",parseFloat(e.target.value)||0)}
                style={{...inputStyle,height:38}} />
            </div>
          </div>

          {/* Corrective Action */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.correctiveAction}</label>
            <textarea value={form.correctiveAction} onChange={e=>set("correctiveAction",e.target.value)}
              placeholder={iF.correctivePlaceholder}
              rows={2} style={{...inputStyle,resize:"vertical"}} />
          </div>

          {/* Resolved */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt2)" }}>
              <input type="checkbox" checked={form.resolved} onChange={e=>{set("resolved",e.target.checked);if(e.target.checked)set("resolvedDate",today());}}
                style={{ accentColor:"var(--g700)" }} />
              {iF.resolved}
            </label>
            {form.resolved && (
              <input type="date" value={form.resolvedDate} onChange={e=>set("resolvedDate",e.target.value)}
                style={{...inputStyle,height:34,marginTop:8,maxWidth:200}} />
            )}
          </div>
        </div>
        <div style={{ padding:"16px 32px",borderTop:"1px solid var(--bdr2)",display:"flex",gap:12,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"9px 20px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"white",cursor:"pointer",fontSize:13,fontWeight:500 }}>{iF.cancel}</button>
          <button onClick={handleSubmit} disabled={!form.date||!form.sopId||!form.description}
            style={{ padding:"9px 24px",background:"var(--g800)",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,opacity:(!form.date||!form.sopId||!form.description)?0.5:1 }}>
            {incident ? iF.saveChanges : iF.logIncident}
          </button>
        </div>
      </div>
    </div>
  );
}
