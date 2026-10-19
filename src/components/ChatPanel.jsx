import { useState, useEffect, useMemo, useRef } from "react";
import { streamAI, parseFormUpdates, stripFormUpdate, toConversation } from "../utils/api.js";
import AiText from "./AiText.jsx";
import { getLocalizedSop } from "../i18n/sop-translations.js";

const PROPOSAL_TEXT = {
  en: {
    group: "Suggested changes to the form",
    title: (n) => `Jimmy suggests filling in ${n} field${n === 1 ? "" : "s"}:`,
    apply: "Apply to form",
    dismiss: "Dismiss",
  },
  es: {
    group: "Cambios sugeridos al formulario",
    title: (n) => `Jimmy sugiere llenar ${n} campo${n === 1 ? "" : "s"}:`,
    apply: "Aplicar al formulario",
    dismiss: "Descartar",
  },
};

const PREVIEW_CHARS = 160;
const preview = (value) => {
  const text = Array.isArray(value) ? value.join(", ") : value;
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
};
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

export default function ChatPanel({ sop, formData, onFormUpdate, farmProfile }) {
  const { lang } = useLanguage();
  const c = T[lang].chat;

  const [messages, setMessages] = useState([
    { role: "assistant", content: c.greetingText(sop.title) }
  ]);

  useEffect(() => {
    setMessages([{ role: "assistant", content: T[lang].chat.greetingText(sop.title) }]);
  }, [lang, sop.id]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fieldIds = useMemo(() => sop.sections.flatMap((section) => section.fields.map((field) => field.id)), [sop]);
  const fieldLabels = useMemo(
    () => Object.fromEntries(getLocalizedSop(sop, lang).sections.flatMap((section) => section.fields.map((field) => [field.id, field.label]))),
    [sop, lang]
  );
  const p = PROPOSAL_TEXT[lang === "es" ? "es" : "en"];

  // Form changes the assistant suggests are applied only when the person presses Apply.
  const resolveProposal = (index, apply) => {
    const proposal = messages[index]?.proposal;
    if (apply && proposal) onFormUpdate(proposal);
    setMessages(prev => prev.map((m, i) => (i === index ? { ...m, proposal: null, applied: apply } : m)));
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setLoading(true);
    const showAnswer = (answer) => setMessages(prev => [...prev.slice(0, -1), { role: "assistant", ...answer }]);
    let accumulated = "";
    try {
      const { truncated } = await streamAI(
        { mode: "sop_chat", lang, messages: toConversation(history), context: { sopId: sop.id, farm: farmProfile, form: formData } },
        (chunk) => {
          accumulated += chunk;
          showAnswer({ content: stripFormUpdate(accumulated), streaming: true });
        }
      );
      const proposal = parseFormUpdates(accumulated, fieldIds);
      const cutNote = lang === "en" ? "_(The answer was cut short. Ask me to continue.)_" : "_(La respuesta quedó incompleta. Pídeme que continúe.)_";
      const content = [stripFormUpdate(accumulated), truncated ? cutNote : null].filter(Boolean).join("\n\n");
      showAnswer({ content, streaming: false, proposal });
    } catch (e) {
      showAnswer({ content: e.message, streaming: false, error: true });
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: c.quickDescribe, text: c.quickDescribeText },
    { label: c.quickReview, text: c.quickReviewText },
    { label: c.quickExplain, text: c.quickExplainText },
    { label: c.quickExamples, text: c.quickExamplesText },
  ];

  const senderYou = lang === "en" ? "You" : "Tú";

  return (
    <div style={{
      width: 440, minWidth: 400, display: "flex", flexDirection: "column",
      borderLeft: "1px solid var(--u-navy-l)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(229,244,253,0.85))",
      backdropFilter: "blur(20px)",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.05)"
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 28px",
        background: "linear-gradient(90deg, var(--u-navy), var(--u-navy-l))",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>{c.assistantName}</div>
        <div style={{ fontSize: 13, color: "var(--u-gold)", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>{c.aiGuide}</div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#94a3b8",
              marginBottom: 5,
            }}>
              {msg.role === "user" ? senderYou : c.assistantName}
            </div>
            <div style={{
              maxWidth: "92%", padding: "16px 20px",
              borderRadius: msg.role === "user" ? "22px 22px 4px 22px" : "22px 22px 22px 4px",
              background: msg.role === "user" ? "var(--u-navy)" : "white",
              color: msg.role === "user" ? "white" : "var(--txt)", fontSize: 15, lineHeight: 1.6,
              boxShadow: msg.role === "user" ? "0 8px 16px rgba(0,45,84,0.25)" : "0 4px 12px rgba(0,0,0,0.08)",
              border: msg.role === "user" ? "none" : "1px solid var(--glass-bdr)"
            }}>
              {msg.role === "user" || msg.error ? (
                <span role={msg.error ? "alert" : undefined} style={{ whiteSpace: "pre-wrap", color: msg.error ? "var(--red)" : undefined }}>{msg.content}</span>
              ) : (
                <AiText text={msg.content} variant="panel" />
              )}
              {msg.streaming && !msg.content && (
                <span style={{ display: "inline-block", width: 2, height: "1em", background: "currentColor", marginLeft: 2, verticalAlign: "text-bottom", animation: "caretBlink 0.8s step-end infinite" }} />
              )}
            </div>
            {msg.proposal && (
              <div role="group" aria-label={p.group} style={{ maxWidth: "92%", marginTop: 8, padding: "12px 14px", borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 14, color: "var(--u-navy)" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{p.title(Object.keys(msg.proposal).length)}</div>
                <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
                  {Object.entries(msg.proposal).map(([id, value]) => (
                    <li key={id} style={{ marginBottom: 4, whiteSpace: "pre-wrap" }}><strong>{fieldLabels[id] ?? id}</strong>: {preview(value)}</li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => resolveProposal(i, true)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: "var(--u-navy)", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{p.apply}</button>
                  <button type="button" onClick={() => resolveProposal(i, false)} style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid var(--bdr)", background: "white", color: "var(--txt2)", cursor: "pointer", fontFamily: "inherit" }}>{p.dismiss}</button>
                </div>
              </div>
            )}
            {msg.applied && <div style={{ marginTop: 6, fontSize: 13, color: "var(--g600)" }}>{c.updatedFields}</div>}
          </div>
        ))}

        {loading && !messages.some(m => m.streaming) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 5 }}>
              {c.assistantName}
            </div>
            <div style={{
              padding: "14px 20px",
              background: "var(--cream2)",
              borderRadius: "22px 22px 22px 4px",
              fontSize: 15, color: "var(--g600)", fontStyle: "italic",
            }}>
              {lang === "en" ? "Composing response..." : "Redactando respuesta..."}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--bdr2)", display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickActions.map(a => (
          <button key={a.label} onClick={() => sendMessage(a.text)}
            style={{ fontSize: 13, padding: "7px 14px", border: "1.5px solid var(--bdr)", borderRadius: 24, background: "white", cursor: "pointer", color: "var(--txt2)", whiteSpace: "nowrap", transition: "all .2s", fontFamily: "inherit" }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "20px 24px 32px", borderTop: "1px solid var(--bdr2)", display: "flex", gap: 12, background: "rgba(255,255,255,0.5)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder={c.placeholder}
          style={{ flex: 1, padding: "14px 20px", border: "1.5px solid var(--u-navy-l)", borderRadius: 32, fontSize: 15, outline: "none", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "all .2s", fontFamily: "inherit" }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{ width: 52, height: 52, borderRadius: "50%", background: loading || !input.trim() ? "var(--g200)" : "var(--u-navy)", border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 24, color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,45,84,0.4)" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
