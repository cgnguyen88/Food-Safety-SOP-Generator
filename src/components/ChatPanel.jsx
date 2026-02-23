import { useState, useEffect, useRef } from "react";
import { callClaude, parseFormUpdates, stripFormUpdate } from "../utils/api.js";

export default function ChatPanel({ sop, formData, onFormUpdate, farmProfile }) {
  const [messages, setMessages] = useState([
    { role:"assistant", content:`Hello! I'm your food safety compliance assistant. I'm here to help you complete the **${sop.title}** SOP.\n\nI can:\n• **Fill in fields** based on your farm description\n• **Explain regulations** behind each requirement\n• **Review your form** for compliance gaps\n• **Provide examples** for any field\n\nHow would you like to start? Describe your farm and operation, or ask me about any specific field.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const buildSystemPrompt = () => {
    const filledFields = Object.entries(formData).filter(([,v])=>v).map(([k,v])=>`${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
    const allFields = sop.sections.flatMap(s=>s.fields).map(f=>`${f.id} (${f.label}${f.required?" — REQUIRED":""})`).join(", ");
    return `You are an expert FSMA Produce Safety Rule (PSR) food safety compliance assistant helping a farm operator complete their "${sop.title}" SOP.
Reference: ${sop.ref}

${farmProfile ? `FARM PROFILE:\nFarm: ${farmProfile.farm_name||""}\nOwner: ${farmProfile.owner_name||""}\nAddress: ${farmProfile.address||""}\nOperation: ${farmProfile.operation_type||""}\nCrops: ${farmProfile.crops||""}\nFSMA Status: ${farmProfile.fsma_status||""}` : "No farm profile saved yet."}

SOP PURPOSE: ${sop.desc}

CURRENT FORM VALUES (already filled):
${filledFields || "No fields filled yet"}

ALL FORM FIELDS AVAILABLE TO FILL:
${allFields}

INSTRUCTIONS:
1. Be conversational, specific, and helpful. Answer questions about food safety regulations accurately.
2. When you have enough info to fill one or more fields, include a form_update block:
<form_update>
{"field_id": "value to populate", "another_field": "its value"}
</form_update>
Use the exact field IDs listed above. Values should be complete, regulatory-compliant text.
3. For textarea fields, use \\n for line breaks.
4. For checkbox-multiple fields, provide values as arrays: ["Option 1", "Option 2"]
5. When reviewing the form, check all required fields and flag specific compliance gaps.
6. Reference FDA FSMA PSR, Cornell PSA, UC Davis Post-PSA, and UMD Extension guidance where relevant.
7. Keep responses concise — 2-4 paragraphs max unless explaining regulations in detail.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role:"user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await callClaude(apiMessages, buildSystemPrompt());
      const formUpdate = parseFormUpdates(response);
      const cleanResponse = stripFormUpdate(response);
      if (formUpdate) onFormUpdate(formUpdate);
      setMessages(prev => [...prev, { role:"assistant", content: cleanResponse + (formUpdate ? "\n\nI've updated the relevant fields in the form." : "") }]);
    } catch (e) {
      setMessages(prev => [...prev, { role:"assistant", content:`Connection error: ${e.message}\n\nPlease check your API key configuration.` }]);
    }
    setLoading(false);
  };

  const quickActions = [
    { label:"Describe my farm", text:"Let me describe my farm operation so you can help fill in this SOP." },
    { label:"Review my form", text:"Please review my current form for any missing required fields or compliance gaps." },
    { label:"Explain this SOP", text:"Can you explain the regulatory requirements behind this SOP and what FSMA expects?" },
    { label:"Give me examples", text:"Can you give me example responses for the main fields in this SOP?" },
  ];

  const renderMarkdown = (text) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  return (
    <div style={{ width:380,minWidth:340,display:"flex",flexDirection:"column",borderRight:"1.5px solid var(--bdr2)",background:"white" }}>
      <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--bdr2)",background:"var(--g50)" }}>
        <div style={{ fontSize:13,fontWeight:600,color:"var(--g800)" }}>AI Food Safety Assistant</div>
        <div style={{ fontSize:11,color:"var(--txt3)",marginTop:2 }}>Powered by Claude</div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12 }}>
        {messages.map((msg,i) => (
          <div key={i} style={{ display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
            <div style={{
              maxWidth:"88%", padding:"10px 14px", borderRadius: msg.role==="user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: msg.role==="user" ? "var(--g800)" : "var(--cream2)",
              color: msg.role==="user" ? "white" : "var(--txt)", fontSize:13, lineHeight:1.6,
            }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex",gap:4,padding:"10px 14px",background:"var(--cream2)",borderRadius:"14px 14px 14px 4px",width:"fit-content" }}>
            {[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"var(--g600)",animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:"12px 16px",borderTop:"1px solid var(--bdr2)",display:"flex",flexWrap:"wrap",gap:6 }}>
        {quickActions.map(a=>(
          <button key={a.label} onClick={()=>sendMessage(a.text)}
            style={{ fontSize:11,padding:"5px 10px",border:"1px solid var(--bdr)",borderRadius:20,background:"var(--cream)",cursor:"pointer",color:"var(--txt2)",whiteSpace:"nowrap" }}>
            {a.label}
          </button>
        ))}
      </div>
      <div style={{ padding:"12px 16px",borderTop:"1px solid var(--bdr2)",display:"flex",gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage(input)}
          placeholder="Ask about this SOP or describe your farm..."
          style={{ flex:1,padding:"10px 14px",border:"1.5px solid var(--bdr)",borderRadius:24,fontSize:13,outline:"none",background:"var(--cream)" }} />
        <button onClick={()=>sendMessage(input)} disabled={loading||!input.trim()}
          style={{ width:42,height:42,borderRadius:"50%",background:loading||!input.trim()?"var(--g200)":"var(--g800)",border:"none",cursor:loading||!input.trim()?"not-allowed":"pointer",fontSize:18,color:"white",display:"flex",alignItems:"center",justifyContent:"center" }}>
          ↑
        </button>
      </div>
    </div>
  );
}
