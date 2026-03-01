import { useState, useEffect, useRef } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { VIOLATION_TYPES, SEVERITY_LEVELS, CORRECTIVE_COST_TYPES, DEFAULT_COST_SETTINGS } from "../data/cost-defaults.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

const today = () => new Date().toISOString().split("T")[0];
const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw limit per file
const COMPRESS_MAX_W = 1400;        // px — resize large photos before storing

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) { reject(new Error("tooBig")); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > COMPRESS_MAX_W) { h = Math.round((h * COMPRESS_MAX_W) / w); w = COMPRESS_MAX_W; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.82), name: file.name });
      };
      img.onerror = () => reject(new Error("badImage"));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function IncidentLogForm({ incident, onSave, onClose, costSettings = DEFAULT_COST_SETTINGS }) {
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
    downtimeCostOverride: 0,
    correctiveAction: "",
    correctiveCosts: [],
    resolved: false,
    resolvedDate: "",
    images: [],
  });
  const [photoWarning, setPhotoWarning] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Hours + minutes split for downtime input
  const [dtH, setDtH] = useState(() => Math.floor(incident?.downtimeHours || 0));
  const [dtM, setDtM] = useState(() => Math.round(((incident?.downtimeHours || 0) % 1) * 60));

  const updateDowntime = (h, m) => {
    const total = Math.round((h + m / 60) * 100) / 100;
    set("downtimeHours", total);
  };

  const downtimeRate = costSettings.downtimeHourlyRate ?? costSettings.laborHourlyRate ?? 50;
  const estimatedDowntimeCost = form.downtimeCostOverride > 0
    ? form.downtimeCostOverride
    : Math.round(form.downtimeHours * downtimeRate * 100) / 100;

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

  const handlePhotos = async (files) => {
    setPhotoWarning("");
    const current = form.images || [];
    const remaining = MAX_PHOTOS - current.length;
    if (remaining <= 0) { setPhotoWarning(iF.photoMaxWarning); return; }
    const toProcess = Array.from(files).slice(0, remaining);
    setPhotoLoading(true);
    const results = [];
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        results.push(compressed);
      } catch (e) {
        if (e.message === "tooBig") setPhotoWarning(iF.photoSizeWarning);
      }
    }
    if (results.length) set("images", [...current, ...results]);
    if (Array.from(files).length > remaining) setPhotoWarning(iF.photoMaxWarning);
    setPhotoLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx) => {
    set("images", (form.images || []).filter((_, i) => i !== idx));
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
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                <div style={{ display:"flex",alignItems:"center",gap:4,flex:1 }}>
                  <input
                    type="number" min="0" step="1"
                    value={dtH}
                    onChange={e => { const h = Math.max(0, parseInt(e.target.value)||0); setDtH(h); updateDowntime(h, dtM); }}
                    style={{...inputStyle,height:38,textAlign:"right",minWidth:0}}
                  />
                  <span style={{ fontSize:12,color:"var(--txt3)",flexShrink:0 }}>h</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:4,flex:1 }}>
                  <input
                    type="number" min="0" max="59" step="1"
                    value={dtM}
                    onChange={e => { const m = Math.min(59, Math.max(0, parseInt(e.target.value)||0)); setDtM(m); updateDowntime(dtH, m); }}
                    style={{...inputStyle,height:38,textAlign:"right",minWidth:0}}
                  />
                  <span style={{ fontSize:12,color:"var(--txt3)",flexShrink:0 }}>min</span>
                </div>
              </div>
              {(dtH > 0 || dtM > 0) && (
                <div style={{ marginTop:5,fontSize:11,color:"var(--u-navy)",fontWeight:600 }}>
                  ≈ ${estimatedDowntimeCost.toLocaleString()} {iF.downtimeEstimate}
                </div>
              )}
            </div>
          </div>

          {/* Downtime Cost Override */}
          <div style={{ marginBottom:14, padding:"12px 14px", background:"rgba(0,45,84,0.03)", border:"1.5px solid var(--bdr)", borderRadius:10 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
              <div style={{ flex:1 }}>
                <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:3 }}>
                  ⏱️ {iF.downtimeCostOverride}
                </label>
                <span style={{ fontSize:11,color:"var(--txt3)",lineHeight:1.4 }}>{iF.downtimeCostOverrideHint}</span>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:5,flexShrink:0 }}>
                <span style={{ fontSize:13,color:"var(--txt3)",fontWeight:600 }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.downtimeCostOverride}
                  onChange={e=>set("downtimeCostOverride", parseFloat(e.target.value)||0)}
                  placeholder="0"
                  style={{...inputStyle,height:38,width:110,textAlign:"right"}}
                />
              </div>
            </div>
            {form.downtimeCostOverride > 0 && (
              <div style={{ marginTop:8, fontSize:11, color:"var(--u-navy)", fontWeight:600 }}>
                ✓ {iF.downtimeCostOverrideActive}
              </div>
            )}
          </div>

          {/* Corrective Action */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:5 }}>{iF.correctiveAction}</label>
            <textarea value={form.correctiveAction} onChange={e=>set("correctiveAction",e.target.value)}
              placeholder={iF.correctivePlaceholder}
              rows={2} style={{...inputStyle,resize:"vertical"}} />
          </div>

          {/* Corrective Action Costs */}
          <div style={{ marginBottom:14 }}>
            <div style={{ marginBottom:8 }}>
              <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)" }}>
                💰 {iF.correctiveCostsTitle}
              </label>
              <span style={{ fontSize:11,color:"var(--txt3)" }}>{iF.correctiveCostsHint}</span>
            </div>
            <div style={{ border:"1.5px solid var(--bdr)",borderRadius:10,overflow:"hidden" }}>
              {CORRECTIVE_COST_TYPES.map((type, idx) => {
                const entry = (form.correctiveCosts||[]).find(c => c.type === type.id);
                const isLast = idx === CORRECTIVE_COST_TYPES.length - 1;
                return (
                  <div key={type.id} style={{
                    display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                    borderBottom: isLast ? "none" : "1px solid var(--bdr2)",
                    background: entry ? "rgba(0,45,84,0.04)" : "white",
                    transition:"background .15s",
                  }}>
                    <input
                      type="checkbox"
                      checked={!!entry}
                      onChange={() => {
                        if (entry) {
                          set("correctiveCosts", (form.correctiveCosts||[]).filter(c => c.type !== type.id));
                        } else {
                          set("correctiveCosts", [...(form.correctiveCosts||[]), { type: type.id, cost: 0 }]);
                        }
                      }}
                      style={{ accentColor:"var(--u-navy)",width:16,height:16,flexShrink:0,cursor:"pointer" }}
                    />
                    <span style={{ fontSize:13,fontWeight:14 }}>{type.icon}</span>
                    <span style={{ flex:1,fontSize:13,color:"var(--txt2)",fontWeight: entry ? 600 : 400 }}>
                      {iF.correctiveCostTypes[type.id]}
                    </span>
                    {entry && (
                      <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                        <span style={{ fontSize:12,color:"var(--txt3)",fontWeight:600 }}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={entry.cost}
                          onChange={e => {
                            const cost = parseFloat(e.target.value) || 0;
                            set("correctiveCosts", (form.correctiveCosts||[]).map(c => c.type === type.id ? { ...c, cost } : c));
                          }}
                          style={{ width:90,padding:"5px 8px",border:"1.5px solid var(--u-navy-l)",borderRadius:6,fontSize:13,outline:"none",textAlign:"right",fontFamily:"'IBM Plex Sans',sans-serif" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(form.correctiveCosts||[]).length > 0 && (
              <div style={{ display:"flex",justifyContent:"flex-end",marginTop:8,gap:8,alignItems:"center" }}>
                <span style={{ fontSize:12,color:"var(--txt3)" }}>{iF.correctiveCostsTotal}:</span>
                <span style={{ fontSize:14,fontWeight:700,color:"var(--u-navy)" }}>
                  ${(form.correctiveCosts||[]).reduce((s,c)=>s+(c.cost||0),0).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Photo Evidence */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"var(--txt2)" }}>
                  📷 {iF.photos}
                </label>
                <span style={{ fontSize:11, color:"var(--txt3)" }}>{iF.photosHint}</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoLoading || (form.images||[]).length >= MAX_PHOTOS}
                style={{
                  padding:"7px 14px", border:"1.5px solid var(--u-navy-l)", borderRadius:8,
                  background:"white", cursor:"pointer", fontSize:12, fontWeight:600, color:"var(--u-navy)",
                  display:"flex", alignItems:"center", gap:6, transition:"all .15s", flexShrink:0,
                  opacity: (form.images||[]).length >= MAX_PHOTOS ? 0.4 : 1,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--cream)"}
                onMouseLeave={e => e.currentTarget.style.background = "white"}
              >
                {photoLoading ? "⏳" : "📎"} {iF.addPhotos}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display:"none" }}
                onChange={e => handlePhotos(e.target.files)}
              />
            </div>

            {/* Warning */}
            {photoWarning && (
              <div style={{ fontSize:11, color:"var(--red)", marginBottom:8, padding:"6px 10px", background:"var(--red-l)", borderRadius:6 }}>
                ⚠️ {photoWarning}
              </div>
            )}

            {/* Drop zone (when no photos yet) */}
            {(form.images||[]).length === 0 && !photoLoading && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--u-navy)"; e.currentTarget.style.background = "var(--cream)"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.background = "white"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.background = "white"; handlePhotos(e.dataTransfer.files); }}
                style={{
                  border:"2px dashed var(--bdr)", borderRadius:10, padding:"20px",
                  textAlign:"center", cursor:"pointer", background:"white", transition:"all .2s",
                }}
              >
                <div style={{ fontSize:28, marginBottom:6 }}>📸</div>
                <div style={{ fontSize:12, color:"var(--txt3)", fontWeight:500 }}>
                  Click to attach or drag & drop photos here
                </div>
              </div>
            )}

            {/* Thumbnail grid */}
            {(form.images||[]).length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))", gap:8 }}>
                {(form.images||[]).map((img, idx) => (
                  <div key={idx} style={{ position:"relative", borderRadius:8, overflow:"hidden", aspectRatio:"1", border:"1.5px solid var(--bdr2)" }}>
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                    />
                    {/* Overlay on hover */}
                    <div style={{
                      position:"absolute", inset:0, background:"rgba(0,0,0,0.45)",
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      opacity:0, transition:"opacity .15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    >
                      <button
                        onClick={() => removePhoto(idx)}
                        style={{ background:"#dc2626", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", color:"white", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}
                      >✕</button>
                    </div>
                    {/* Name tooltip */}
                    <div style={{
                      position:"absolute", bottom:0, left:0, right:0,
                      background:"rgba(0,0,0,0.55)", padding:"3px 5px",
                      fontSize:9, color:"white", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>
                      {img.name}
                    </div>
                  </div>
                ))}
                {/* Add more button if < max */}
                {(form.images||[]).length < MAX_PHOTOS && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border:"2px dashed var(--bdr)", borderRadius:8, aspectRatio:"1",
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      cursor:"pointer", background:"white", transition:"all .15s", gap:4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--cream)"}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}
                  >
                    <span style={{ fontSize:20, color:"var(--txt3)" }}>+</span>
                    <span style={{ fontSize:10, color:"var(--txt3)" }}>{iF.addPhotos}</span>
                  </div>
                )}
              </div>
            )}

            {(form.images||[]).length > 0 && (
              <div style={{ fontSize:11, color:"var(--txt3)", marginTop:6 }}>
                {iF.photosOf((form.images||[]).length)} · {MAX_PHOTOS - (form.images||[]).length} remaining
              </div>
            )}
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
