import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

export default function ReviewPanel({ sop, missingFields, onClose }) {
  const { lang } = useLanguage();
  const r = T[lang].review;

  if (!missingFields || missingFields.length === 0) {
    return (
      <div style={{ width:300,borderLeft:"1.5px solid var(--g200)",background:"var(--g50)",display:"flex",flexDirection:"column",flexShrink:0 }}>
        <div style={{ padding:"20px",borderBottom:"1px solid var(--g200)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <h3 style={{ fontSize:15,fontWeight:600,color:"var(--g800)" }}>{r.title}</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--txt3)" }}>✕</button>
        </div>
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center" }}>
          <div style={{ fontSize:48,marginBottom:16 }}>✅</div>
          <h4 style={{ fontSize:16,fontWeight:600,color:"var(--g800)",marginBottom:8 }}>{r.allClear}</h4>
          <p style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.5 }}>{r.allClearDesc}</p>
        </div>
      </div>
    );
  }

  // Group missing fields by section
  const grouped = [];
  sop.sections.forEach(section => {
    const sectionMissing = section.fields.filter(f => missingFields.includes(f.id));
    if (sectionMissing.length > 0) {
      grouped.push({ section, fields: sectionMissing });
    }
  });

  const scrollToField = (fieldId) => {
    const el = document.getElementById(`field-${fieldId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.transition = "background .3s";
      el.style.background = "#fef3c7";
      setTimeout(() => { el.style.background = ""; }, 2000);
    }
  };

  return (
    <div style={{ width:300,borderLeft:"1.5px solid var(--bdr2)",background:"white",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
      <div style={{ padding:"20px",borderBottom:"1px solid var(--bdr2)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <h3 style={{ fontSize:15,fontWeight:600,color:"var(--red)" }}>{r.title}</h3>
          <p style={{ fontSize:12,color:"var(--txt3)",marginTop:2 }}>{r.missingField(missingFields.length)}</p>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--txt3)" }}>✕</button>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"16px" }}>
        {grouped.map(({ section, fields }) => (
          <div key={section.id} style={{ marginBottom:16 }}>
            <div style={{ fontSize:11,fontWeight:600,color:"var(--txt3)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8 }}>{section.title}</div>
            {fields.map(field => (
              <button
                key={field.id}
                onClick={() => scrollToField(field.id)}
                style={{
                  width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",marginBottom:4,
                  background:"var(--red-l)",border:"1px solid #fecaca",borderRadius:8,cursor:"pointer",textAlign:"left",
                  transition:"background .15s",
                }}
              >
                <span style={{ color:"var(--red)",fontSize:14,flexShrink:0 }}>!</span>
                <span style={{ fontSize:12,color:"var(--txt)",lineHeight:1.4 }}>{field.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
