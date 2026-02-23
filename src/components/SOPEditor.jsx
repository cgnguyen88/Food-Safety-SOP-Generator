import { useState, useEffect } from "react";
import ChatPanel from "./ChatPanel.jsx";
import FormPanel from "./FormPanel.jsx";
import ExportModal from "./ExportModal.jsx";
import ReviewPanel from "./ReviewPanel.jsx";

export default function SOPEditor({ sop, farmProfile, onBack }) {
  const [formData, setFormData] = useState(() => {
    const init = {};
    if (farmProfile?.farm_name) init.farm_name = farmProfile.farm_name;
    if (farmProfile?.owner_name) init.prepared_by = farmProfile.owner_name;
    return init;
  });
  const [missingFields, setMissingFields] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Clear review state when SOP changes
  useEffect(() => {
    setMissingFields([]);
    setShowReview(false);
  }, [sop.id]);

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
  const pct = completionPct();

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ padding:"14px 24px",borderBottom:"1.5px solid var(--bdr2)",display:"flex",alignItems:"center",gap:16,background:"white",flexShrink:0 }} className="no-print">
        <button onClick={onBack} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt2)" }}>
          ← Back
        </button>
        <span style={{ fontSize:20 }}>{sop.icon}</span>
        <div style={{ flex:1 }}>
          <h2 style={{ fontFamily:"Lora,serif",fontSize:17,color:"var(--g900)",lineHeight:1.2 }}>{sop.title}</h2>
          <p style={{ fontSize:11,color:"var(--txt3)",marginTop:2 }}>{sop.ref}</p>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11,color:"var(--txt3)" }}>Completion</div>
            <div style={{ fontSize:16,fontWeight:700,color:pct<40?"var(--red)":pct<80?"var(--gold)":"var(--g700)" }}>{pct}%</div>
          </div>
          <div style={{ width:6,height:52,background:"var(--cream3)",borderRadius:3,overflow:"hidden" }}>
            <div style={{ width:"100%",height:`${pct}%`,background:pct<40?"var(--red)":pct<80?"var(--gold)":"var(--g600)",borderRadius:3,transition:"height .3s",marginTop:`${100-pct}%` }} />
          </div>
        </div>
        <button onClick={handleReview} style={{ padding:"8px 16px",background:"var(--cream2)",border:"1.5px solid var(--bdr)",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt)" }}>
          Review
        </button>
        <button onClick={()=>setShowExport(true)} style={{ padding:"8px 18px",background:"var(--g800)",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>
          Export
        </button>
      </div>
      {/* Main split layout */}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }} className="no-print">
        <ChatPanel sop={sop} formData={formData} onFormUpdate={handleFormUpdate} farmProfile={farmProfile} />
        <FormPanel sop={sop} formData={formData} onChange={handleChange} missingFields={missingFields} farmProfile={farmProfile} />
        {showReview && <ReviewPanel sop={sop} missingFields={missingFields} onClose={() => setShowReview(false)} />}
      </div>
      {/* Print view */}
      <div className="print-content" style={{ display:"none" }}>
        <h1 style={{ fontFamily:"Lora,serif",fontSize:24,color:"#14532d",borderBottom:"2px solid #14532d",paddingBottom:8,marginBottom:16 }}>
          {farmProfile?.farm_name ? `${farmProfile.farm_name} — ` : ""}{sop.title}
        </h1>
        {sop.sections.map(s => (
          <div key={s.id} style={{ marginBottom:24 }}>
            <h2 style={{ fontSize:16,color:"#166534",marginBottom:12 }}>{s.title}</h2>
            {s.fields.map(f => (
              <div key={f.id} style={{ marginBottom:10 }}>
                <strong style={{ fontSize:13 }}>{f.label}: </strong>
                <span style={{ fontSize:13 }}>{Array.isArray(formData[f.id]) ? formData[f.id].join(", ") : (formData[f.id] || "___________________________")}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {showExport && <ExportModal sop={sop} formData={formData} farmProfile={farmProfile} onClose={()=>setShowExport(false)} />}
    </div>
  );
}
