import { useState } from "react";
import { COST_FIELDS, DEFAULT_COST_SETTINGS } from "../data/cost-defaults.js";

export default function CostSettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings || DEFAULT_COST_SETTINGS);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--cream)",borderRadius:16,width:"min(480px,95vw)",boxShadow:"var(--shadow-lg)" }}>
        <div style={{ padding:"24px 32px 16px",borderBottom:"1px solid var(--bdr2)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <h2 style={{ fontFamily:"Lora,serif",fontSize:20,color:"var(--g900)" }}>Cost Parameters</h2>
            <p style={{ fontSize:12,color:"var(--txt3)",marginTop:2 }}>Configure economic impact calculations</p>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--txt3)" }}>✕</button>
        </div>
        <div style={{ padding:"20px 32px" }}>
          {COST_FIELDS.map(field => (
            <div key={field.id} style={{ marginBottom:16 }}>
              <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{field.label}</label>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:14,color:"var(--txt2)",fontWeight:600 }}>{field.prefix}</span>
                <input
                  type="number" step="0.01" min="0"
                  value={form[field.id]}
                  onChange={e => setForm({ ...form, [field.id]: parseFloat(e.target.value) || 0 })}
                  style={{ flex:1,padding:"8px 12px",border:"1.5px solid var(--bdr)",borderRadius:8,fontSize:13,background:"white",outline:"none" }}
                />
                {field.suffix && <span style={{ fontSize:12,color:"var(--txt3)" }}>{field.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"16px 32px",borderTop:"1px solid var(--bdr2)",display:"flex",gap:12,justifyContent:"space-between" }}>
          <button onClick={() => setForm(DEFAULT_COST_SETTINGS)}
            style={{ padding:"9px 16px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"white",cursor:"pointer",fontSize:12,fontWeight:500,color:"var(--txt2)" }}>
            Reset to Defaults
          </button>
          <div style={{ display:"flex",gap:12 }}>
            <button onClick={onClose} style={{ padding:"9px 20px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"white",cursor:"pointer",fontSize:13,fontWeight:500 }}>Cancel</button>
            <button onClick={()=>onSave(form)} style={{ padding:"9px 24px",background:"var(--g800)",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
