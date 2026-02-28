import { useState } from "react";
import { generateShareLink, downloadAsDocx, printAsPdf } from "../utils/export.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

export default function ExportModal({ sop, formData, farmProfile, onClose }) {
  const { lang } = useLanguage();
  const em = T[lang].exportModal;
  const [copied, setCopied] = useState(false);
  const [printError, setPrintError] = useState("");
  const shareLink = generateShareLink(sop.id, formData);

  const handlePrint = () => {
    try {
      setPrintError("");
      printAsPdf(sop, formData, farmProfile);
      onClose();
    } catch (e) {
      setPrintError(e.message || "Unable to open print window.");
    }
  };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  return (
    <div className="no-print" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--cream)",borderRadius:16,width:"min(480px,95vw)",boxShadow:"var(--shadow-lg)" }}>
        <div style={{ padding:"28px 32px 20px",borderBottom:"1px solid var(--bdr2)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <h2 style={{ fontFamily:"Lora,serif",fontSize:20,color:"var(--g900)" }}>{em.title}</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--txt3)" }}>✕</button>
        </div>
        <div style={{ padding:"24px 32px",display:"flex",flexDirection:"column",gap:12 }}>
          {[
            { icon:"🖨️", label: em.printLabel, desc: em.printDesc, action: handlePrint, color:"var(--g800)" },
            { icon:"📄", label: em.wordLabel, desc: em.wordDesc, action:()=>{downloadAsDocx(sop,formData,farmProfile);onClose();}, color:"var(--sky)" },
            { icon:"🔗", label: copied ? em.linkCopied : em.linkLabel, desc: em.linkDesc, action: handleCopyLink, color: copied ? "var(--g700)" : "var(--gold)" },
          ].map((btn,i) => (
            <button key={i} onClick={btn.action} style={{ display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:"white",border:"1.5px solid var(--bdr)",borderRadius:12,cursor:"pointer",textAlign:"left",transition:"border-color .15s" }}>
              <span style={{ fontSize:28 }}>{btn.icon}</span>
              <div>
                <div style={{ fontWeight:600,fontSize:14,color:btn.color }}>{btn.label}</div>
                <div style={{ fontSize:12,color:"var(--txt3)",marginTop:2 }}>{btn.desc}</div>
              </div>
            </button>
          ))}
          {printError && (
            <div style={{ fontSize:12, color:"var(--red)", paddingTop:4 }}>
              {printError}
            </div>
          )}
        </div>
        <div style={{ padding:"12px 32px 24px" }}>
          <button onClick={onClose} style={{ width:"100%",padding:"10px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt2)" }}>{em.close}</button>
        </div>
      </div>
    </div>
  );
}
