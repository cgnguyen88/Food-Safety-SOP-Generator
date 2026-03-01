import { useState, useEffect, useRef } from "react";
import { callClaudeStreaming, parseFormUpdates, stripFormUpdate } from "../utils/api.js";
import { buildSopStandardContext } from "../utils/sop-standards.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

export default function ChatPanel({ sop, formData, onFormUpdate, farmProfile }) {
  const { lang } = useLanguage();
  const c = T[lang].chat;

  const [messages, setMessages] = useState([
    { role: "assistant", content: c.greetingText(sop.title) }
  ]);

  // Reset chat greeting when language or SOP changes
  useEffect(() => {
    setMessages([{ role: "assistant", content: T[lang].chat.greetingText(sop.title) }]);
  }, [lang, sop.id]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const buildSystemPrompt = () => {
    const filledFields = Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
    const allFields = sop.sections.flatMap(s => s.fields).map(f => `${f.id} (${f.label}${f.required ? " — REQUIRED" : ""})`).join(", ");
    const sopContext = buildSopStandardContext(sop);
    return `Your name is Jimmy. You are a friendly, knowledgeable, and supportive food safety assistant for FarmSafe — like a dedicated customer service agent for farmers and producers. You are helping a farm operator complete their "${sop.title}" SOP. Be warm, encouraging, and practical in your guidance, like a trusted advisor who wants to see the farmer succeed.
Reference: ${sop.ref}
${sopContext}

${farmProfile ? `FARM PROFILE:\nFarm: ${farmProfile.farm_name || ""}\nOwner: ${farmProfile.owner_name || ""}\nAddress: ${farmProfile.address || ""}\nOperation: ${farmProfile.operation_type || ""}\nCrops: ${farmProfile.crops || ""}\nFSMA Status: ${farmProfile.fsma_status || ""}` : "No farm profile saved yet."}

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
7. If uncertain about a regulatory detail, say "Verify against current regulator guidance" instead of inventing specifics.
8. Keep responses concise — 2-4 paragraphs max unless explaining regulations in detail.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setLoading(true);
    let accumulated = "";
    try {
      await callClaudeStreaming(
        history.map(m => ({ role: m.role, content: m.content })),
        buildSystemPrompt(),
        (chunk) => {
          accumulated += chunk;
          // Strip form_update tags from visible text while streaming
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: "assistant", content: stripFormUpdate(accumulated), streaming: true },
          ]);
        }
      );
      // On completion: parse form updates from full accumulated text
      const formUpdate = parseFormUpdates(accumulated);
      const cleanResponse = stripFormUpdate(accumulated);
      if (formUpdate) onFormUpdate(formUpdate);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: cleanResponse + (formUpdate ? `\n\n${c.updatedFields}` : ""), streaming: false },
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Connection error: ${e.message}\n\nPlease check your API key configuration.`, streaming: false },
      ]);
    }
    setLoading(false);
  };

  const quickActions = [
    { label: c.quickDescribe, text: c.quickDescribeText },
    { label: c.quickReview,   text: c.quickReviewText },
    { label: c.quickExplain,  text: c.quickExplainText },
    { label: c.quickExamples, text: c.quickExamplesText },
  ];

  const renderMarkdown = (text) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  return (
    <div style={{
      width: 440, minWidth: 400, display: "flex", flexDirection: "column",
      borderLeft: "1px solid var(--u-navy-l)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(229,244,253,0.85))",
      backdropFilter: "blur(20px)",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.05)"
    }}>
      <div style={{
        padding: "24px 28px",
        background: "linear-gradient(90deg, var(--u-navy), var(--u-navy-l))",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>{c.assistantName}</div>
        <div style={{ fontSize: 13, color: "var(--u-gold)", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>{c.aiGuide}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "92%", padding: "16px 20px", borderRadius: msg.role === "user" ? "22px 22px 4px 22px" : "22px 22px 22px 4px",
              background: msg.role === "user" ? "var(--u-navy)" : "white",
              color: msg.role === "user" ? "white" : "var(--txt)", fontSize: 15, lineHeight: 1.6,
              boxShadow: msg.role === "user" ? "0 8px 16px rgba(0,45,84,0.25)" : "0 4px 12px rgba(0,0,0,0.08)",
              border: msg.role === "user" ? "none" : "1px solid var(--glass-bdr)"
            }}>
              <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              {msg.streaming && (
                <span style={{ display: "inline-block", width: 2, height: "1em", background: "currentColor", marginLeft: 2, verticalAlign: "text-bottom", animation: "caretBlink 0.8s step-end infinite" }} />
              )}
            </div>
          </div>
        ))}
        {loading && !messages.some(m => m.streaming) && (
          <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "var(--cream2)", borderRadius: "14px 14px 14px 4px", width: "fit-content" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--g600)", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--bdr2)", display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickActions.map(a => (
          <button key={a.label} onClick={() => sendMessage(a.text)}
            style={{ fontSize: 13, padding: "7px 14px", border: "1.5px solid var(--bdr)", borderRadius: 24, background: "white", cursor: "pointer", color: "var(--txt2)", whiteSpace: "nowrap", transition: "all .2s" }}>
            {a.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "20px 24px 32px", borderTop: "1px solid var(--bdr2)", display: "flex", gap: 12, background: "rgba(255,255,255,0.5)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder={c.placeholder}
          style={{ flex: 1, padding: "14px 20px", border: "1.5px solid var(--u-navy-l)", borderRadius: 32, fontSize: 15, outline: "none", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "all .2s" }} />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          style={{ width: 52, height: 52, borderRadius: "50%", background: loading || !input.trim() ? "var(--g200)" : "var(--u-navy)", border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 24, color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,45,84,0.4)" }}>
          ↑
        </button>
      </div>
    </div>
  );
}
