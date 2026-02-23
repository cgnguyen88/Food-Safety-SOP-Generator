import { useState } from "react";
import { getFieldSuggestion } from "../utils/api.js";

export default function FormPanel({ sop, formData, onChange, missingFields, farmProfile }) {
  const [openSection, setOpenSection] = useState(sop.sections[0]?.id);
  const [loadingField, setLoadingField] = useState(null);

  const inputStyle = (id) => ({
    width:"100%", padding:"8px 12px", border:`1.5px solid ${missingFields?.includes(id)?"var(--red)":"var(--bdr)"}`,
    borderRadius:8, fontSize:13, background:"white", outline:"none", resize:"vertical",
    fontFamily:"'IBM Plex Sans',sans-serif", transition:"border-color .15s",
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
      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
        {field.checkboxOptions.map(option => (
          <label key={option} style={{ display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer",fontSize:13,color:"var(--txt)",lineHeight:1.5 }}>
            <input
              type="checkbox"
              checked={current.includes(option)}
              onChange={(e) => {
                const updated = e.target.checked
                  ? [...current, option]
                  : current.filter(v => v !== option);
                onChange(field.id, updated);
              }}
              style={{ marginTop:3,accentColor:"var(--g700)" }}
            />
            <span>{option}</span>
          </label>
        ))}
        <input
          type="text"
          placeholder="Other (specify)..."
          style={{ ...inputStyle(field.id), marginTop:4, height:34, fontSize:12 }}
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
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
      {sop.sections.map(section => (
        <div key={section.id} style={{ marginBottom:12,border:"1.5px solid var(--bdr2)",borderRadius:12,overflow:"hidden",background:"white" }}>
          <button onClick={()=>setOpenSection(openSection===section.id?null:section.id)}
            style={{ width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:openSection===section.id?"var(--g50)":"white",border:"none",cursor:"pointer",textAlign:"left" }}>
            <span style={{ fontWeight:600,fontSize:14,color:openSection===section.id?"var(--g800)":"var(--txt)" }}>{section.title}</span>
            <span style={{ fontSize:18,color:"var(--g700)",transform:openSection===section.id?"rotate(180deg)":"",transition:"transform .2s" }}>⌄</span>
          </button>
          {openSection === section.id && (
            <div style={{ padding:"16px 18px 20px",borderTop:"1px solid var(--bdr2)" }}>
              {section.fields.map(field => (
                <div key={field.id} id={`field-${field.id}`} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5 }}>
                    <label style={{ display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:500,color:"var(--txt2)" }}>
                      {field.label}
                      {field.required && <span style={{ color:"var(--red)",fontSize:11 }}>*</span>}
                      {missingFields?.includes(field.id) && <span style={{ fontSize:11,color:"var(--red)",marginLeft:4 }}>Required</span>}
                    </label>
                    {canAISuggest(field) && (
                      <button
                        onClick={() => handleAISuggest(field)}
                        disabled={loadingField === field.id}
                        style={{
                          padding:"3px 10px",fontSize:11,border:"1px solid var(--g200)",borderRadius:12,
                          background:loadingField===field.id?"var(--g100)":"var(--g50)",
                          color:"var(--g800)",cursor:loadingField===field.id?"wait":"pointer",fontWeight:500,
                          opacity:loadingField===field.id?0.7:1,transition:"all .15s",
                        }}
                      >
                        {loadingField === field.id ? "..." : "AI Suggest"}
                      </button>
                    )}
                  </div>
                  {field.type === "checkbox-multiple" ? (
                    renderCheckboxMultiple(field)
                  ) : field.type === "textarea" ? (
                    <textarea value={formData[field.id]||""} onChange={e=>onChange(field.id,e.target.value)}
                      placeholder={field.ph||""} rows={3} style={inputStyle(field.id)} />
                  ) : field.type === "select" ? (
                    <select value={formData[field.id]||""} onChange={e=>onChange(field.id,e.target.value)} style={{...inputStyle(field.id),height:38}}>
                      <option value="">— Select —</option>
                      {field.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.type||"text"} value={formData[field.id]||""} onChange={e=>onChange(field.id,e.target.value)}
                      placeholder={field.ph||""} style={{...inputStyle(field.id),height:38}} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop:16,padding:"16px 18px",border:"1.5px solid var(--bdr2)",borderRadius:12,background:"var(--g50)" }}>
        <div style={{ fontWeight:600,fontSize:13,color:"var(--g800)",marginBottom:8 }}>{sop.log.title}</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
            <thead>
              <tr>{sop.log.cols.map(c=><th key={c} style={{ background:"var(--g800)",color:"white",padding:"7px 8px",textAlign:"left",whiteSpace:"nowrap",fontWeight:500 }}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {[0,1,2].map(i=><tr key={i}>{sop.log.cols.map((c,j)=><td key={j} style={{ border:"1px solid var(--bdr2)",padding:"8px",background:i%2===0?"white":"var(--cream)" }}>&nbsp;</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize:11,color:"var(--txt3)",marginTop:8 }}>Log template — additional rows appear in exported document</p>
      </div>
    </div>
  );
}
