import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ChevronDown } from "lucide-react";
import { callClaudeStreaming } from "../utils/api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { SOP_DATA } from "../data/sop-data.js";

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function ExpandableChat({ farmProfile, incidents }) {
  const { lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  const greeting =
    lang === "en"
      ? "🍓 Hey there! I'm Jimmy, your FarmSafe food safety guide. Whether you have questions about regulations, need help with your SOPs, or just want some guidance — I'm here for you. What can I help you with today?"
      : "🍓 ¡Hola! Soy Jimmy, tu guía de seguridad alimentaria de FarmSafe. Ya sea que tengas preguntas sobre regulaciones, necesites ayuda con tus POEs, o simplemente quieras orientación — aquí estoy para ti. ¿En qué puedo ayudarte hoy?";

  // Reset greeting on language change
  useEffect(() => {
    setMessages([{ role: "assistant", content: greeting }]);
  }, [lang]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Track scroll position
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(atBottom);
  };

  const buildSystemPrompt = () => {
    const sopList = SOP_DATA.map((s) => `[ID:${s.id}] ${s.short} — ${s.desc.slice(0, 80)}`).join("\n");
    const farmCtx = farmProfile
      ? `Farm: ${farmProfile.farm_name || ""}. Crops: ${farmProfile.crops || ""}. Type: ${farmProfile.operation_type || ""}. FSMA status: ${farmProfile.fsma_status || ""}.`
      : "No farm profile saved yet.";
    return `Your name is Jimmy. You are a friendly, knowledgeable, and supportive food safety assistant for FarmSafe — like a dedicated customer service agent specifically for farmers and producers. You assist not only with questions and information requests, but also provide step-by-step guidance and encouragement throughout their food safety compliance journey.

You are embedded in FarmSafe, a compliance platform for California farms. You are an expert in FSMA Produce Safety Rule requirements and also act as a guide and "Skill Creator" for farmers building their Farm Food Safety Plans.

Farm context: ${farmCtx}
Logged incidents so far: ${(incidents || []).length}

Available SOPs in the app:
${sopList}

Answer questions about food safety regulations, FSMA PSR requirements, produce safety best practices, SOP documentation, and how to use the app. As a Skill Creator, guide farmers step-by-step on how to conduct risk assessments, establish a traceability/lot code system (e.g. Farm + Field + Date), and perform a mock recall. Be warm, conversational, specific, and accurate — like a helpful customer service agent who genuinely cares about the farmer's success. Reference FDA FSMA PSR, Cornell PSA, and UC ANR guidance where relevant. Keep responses to 2–4 paragraphs max. Answer in the same language the user writes in (English or Spanish). Do not invent regulatory thresholds — say "verify with current guidance" if uncertain.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setIsAtBottom(true);
    setLoading(true);
    let accumulated = "";
    try {
      await callClaudeStreaming(
        history.map((m) => ({ role: m.role, content: m.content })),
        buildSystemPrompt(),
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: accumulated, streaming: true },
          ]);
        }
      );
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: accumulated, streaming: false },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Connection error: ${e.message}`, streaming: false },
      ]);
    }
    setLoading(false);
  };

  const quickChips =
    lang === "en"
      ? [
        { label: "Plan Generator Help", text: "How do I build a Farm Food Safety Plan?" },
        { label: "Lot codes", text: "How should I create a Lot Code system for my farm?" },
        { label: "Mock Recall", text: "How do I conduct a mock recall?" },
        { label: "Which SOP first?", text: "Which SOP should I work on first for my farm?" },
      ]
      : [
        { label: "Ayuda con el Plan", text: "¿Cómo elaboro un Plan de Seguridad Alimentaria de la Granja?" },
        { label: "Códigos de lote", text: "¿Cómo debo crear un sistema de código de lote para mi granja?" },
        { label: "Simulacro", text: "¿Cómo realizo un simulacro de retiro (mock recall)?" },
        { label: "¿Qué POE primero?", text: "¿En qué POE debería trabajar primero para mi granja?" },
      ];

  const headerLabel =
    lang === "en" ? "Your Food Safety Guide" : "Tu Guía de Seguridad Alimentaria";
  const placeholder =
    lang === "en" ? "Ask about food safety..." : "Pregunta sobre seguridad alimentaria...";

  return (
    <div style={{ position: "fixed", bottom: 24, right: 28, zIndex: 9999 }}>

      {/* Chat Panel */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(100% + 14px)",
          right: 0,
          width: 390,
          height: 540,
          background: "white",
          borderRadius: 22,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,45,84,0.12)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(0,45,84,0.1)",
          // animate open/close
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity .25s ease, transform .25s ease",
          transformOrigin: "bottom right",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(110deg, var(--u-navy) 0%, #1a4a7a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "var(--u-gold)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 12px rgba(253,189,16,0.5)",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>🍓</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>
                Jimmy
              </div>
              <div style={{ fontSize: 11, color: "var(--u-gold)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                {headerLabel}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "rgba(255,255,255,.12)", border: "none", borderRadius: "50%",
              width: 32, height: 32, cursor: "pointer", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.22)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.12)")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1, overflowY: "auto", padding: "16px 16px 8px",
            display: "flex", flexDirection: "column", gap: 14,
            background: "linear-gradient(180deg, #f8fafc 0%, white 100%)",
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              {msg.role === "assistant" && (
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "var(--u-gold)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(253,189,16,0.4)",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>🍓</span>
                </div>
              )}
              <div
                style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user" ? "var(--u-navy)" : "white",
                  color: msg.role === "user" ? "white" : "var(--txt)",
                  fontSize: 13, lineHeight: 1.6,
                  boxShadow: msg.role === "user"
                    ? "0 4px 12px rgba(0,45,84,0.25)"
                    : "0 2px 8px rgba(0,0,0,0.07)",
                  border: msg.role === "assistant" ? "1px solid var(--bdr2)" : "none",
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                {msg.streaming && (
                  <span style={{ display: "inline-block", width: 2, height: "1em", background: "currentColor", marginLeft: 2, verticalAlign: "text-bottom", animation: "caretBlink 0.8s step-end infinite" }} />
                )}
              </div>
              {msg.role === "user" && (
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "var(--u-navy-l)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "white",
                  }}
                >
                  U
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--u-gold)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>🍓</span>
              </div>
              <div style={{ padding: "10px 16px", background: "white", borderRadius: "18px 18px 18px 4px", border: "1px solid var(--bdr2)", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g400)", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {!isAtBottom && (
          <button
            onClick={() => { setIsAtBottom(true); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            style={{
              position: "absolute", left: "50%", transform: "translateX(-50%)",
              bottom: 140, zIndex: 10,
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--u-navy)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,45,84,0.3)",
            }}
          >
            <ChevronDown size={16} color="white" />
          </button>
        )}

        {/* Quick chips */}
        <div
          style={{
            padding: "10px 14px 6px",
            display: "flex", flexWrap: "wrap", gap: 6,
            borderTop: "1px solid var(--bdr2)",
            background: "var(--cream)",
            flexShrink: 0,
          }}
        >
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.text)}
              disabled={loading}
              style={{
                fontSize: 11, padding: "5px 11px",
                border: "1.5px solid var(--bdr)", borderRadius: 20,
                background: "white", cursor: loading ? "not-allowed" : "pointer",
                color: "var(--u-navy)", fontWeight: 600,
                opacity: loading ? 0.5 : 1, transition: "all .15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "var(--u-navy)", e.currentTarget.style.color = "white", e.currentTarget.style.borderColor = "var(--u-navy)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white", e.currentTarget.style.color = "var(--u-navy)", e.currentTarget.style.borderColor = "var(--bdr)")}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div
          style={{
            padding: "10px 14px 14px",
            display: "flex", gap: 8, alignItems: "center",
            background: "white",
            borderTop: "1px solid var(--bdr2)",
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder={placeholder}
            style={{
              flex: 1, padding: "11px 16px",
              border: "1.5px solid var(--bdr)", borderRadius: 24,
              fontSize: 13, outline: "none", background: "var(--cream)",
              fontFamily: "inherit", transition: "border-color .2s",
              color: "var(--txt)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--u-navy-l)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--bdr)")}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
              background: input.trim() && !loading ? "var(--u-navy)" : "var(--g100)",
              border: "none",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .2s",
              boxShadow: input.trim() && !loading ? "0 4px 14px rgba(0,45,84,0.35)" : "none",
            }}
          >
            <Send size={16} color={input.trim() && !loading ? "white" : "var(--g400)"} />
          </button>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        title={lang === "en" ? "Chat with Jimmy" : "Chatear con Jimmy"}
        style={{
          width: 58, height: 58, borderRadius: "50%",
          background: isOpen
            ? "var(--u-navy)"
            : "linear-gradient(135deg, var(--u-navy) 0%, #1a5a9a 100%)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,45,84,0.45), 0 2px 8px rgba(0,0,0,0.2)",
          transition: "all .3s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,45,84,0.5), 0 0 0 4px rgba(0,45,84,0.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,45,84,0.45), 0 2px 8px rgba(0,0,0,0.2)"; }}
      >
        <div style={{ transition: "transform .3s ease", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
          {isOpen ? <X size={24} color="white" /> : <MessageCircle size={24} color="white" />}
        </div>
      </button>
    </div>
  );
}
