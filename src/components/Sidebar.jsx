import { useState, useRef, useEffect } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { callClaudeStreaming } from "../utils/api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

export default function Sidebar({ activeSOP, activePage, onSelectSOP, onOpenProfile, onNavigate, onLogout, currentUser, farmProfile, incidents }) {
  const { lang, toggleLang } = useLanguage();
  const s = T[lang].sidebar;

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  const localizedSops = SOP_DATA.map(sop => getLocalizedSop(sop, lang));

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const buildSystemPrompt = () => {
    const sopList = SOP_DATA.map(s => `[ID:${s.id}] ${s.short} — ${s.desc.slice(0, 90)}`).join("\n");
    const farmCtx = farmProfile
      ? `Farm: ${farmProfile.farm_name || ""}. Crops: ${farmProfile.crops || ""}. Type: ${farmProfile.operation_type || ""}.`
      : "No farm profile saved yet.";
    const incidentCount = (incidents || []).length;
    return `You are a concise food safety AI assistant in the FarmSafe sidebar. Keep every response to 1-3 short sentences — this is a compact sidebar, not a full chat.

App pages: Dashboard (SOP templates), Violation Dashboard (log & track incidents), Economic Report (cost analysis), Farm Profile (farm details).

Available SOPs:\n${sopList}

Farm context: ${farmCtx}
Logged incidents: ${incidentCount}

RULES:
- Answer in the same language the user writes in (English or Spanish).
- Be direct and specific. No preambles.
- If you recommend a page, append exactly one of these tags on its own line: [NAV:home] [NAV:violations] [NAV:economic]
- If you recommend a specific SOP, append [SOP:N] where N is the numeric ID.
- Never include both a NAV and SOP tag in the same response.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || chatLoading) return;
    const history = [...chatMessages, { role: "user", content: text }];
    setChatMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setChatInput("");
    setChatLoading(true);
    let accumulated = "";
    try {
      await callClaudeStreaming(
        history.map(m => ({ role: m.role, content: m.content })),
        buildSystemPrompt(),
        (chunk) => {
          accumulated += chunk;
          setChatMessages(prev => [
            ...prev.slice(0, -1),
            { role: "assistant", content: accumulated, streaming: true },
          ]);
        }
      );
      const navMatch = accumulated.match(/\[NAV:(home|violations|economic)\]/);
      const sopMatch = accumulated.match(/\[SOP:(\d+)\]/);
      const content = accumulated.replace(/\[NAV:[^\]]+\]/g, "").replace(/\[SOP:\d+\]/g, "").trim();
      setChatMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content, streaming: false, navTo: navMatch?.[1] || null, sopId: sopMatch ? parseInt(sopMatch[1]) : null },
      ]);
    } catch (e) {
      setChatMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Error: ${e.message}`, streaming: false },
      ]);
    }
    setChatLoading(false);
  };

  const quickChips = [
    { label: s.chipWhichSop,     text: s.chipWhichSopText },
    { label: s.chipFsma,         text: s.chipFsmaText },
    { label: s.chipLogIncident,  text: s.chipLogIncidentText },
    { label: s.chipCosts,        text: s.chipCostsText },
  ];

  const navLabels = { home: s.dashboard, violations: s.violations, economic: s.economic };

  return (
    <div style={{ width: 300, background: "var(--u-navy)", color: "white", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid rgba(255,255,255,.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Lora,serif", fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>FarmSafe</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 3 }}>{s.appSub}</div>
          </div>
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            title={lang === "en" ? "Switch to Spanish" : "Cambiar a Inglés"}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 24,
              border: "2px solid var(--u-gold)",
              background: "var(--u-gold)",
              color: "var(--u-navy-d)", cursor: "pointer",
              fontSize: 13, fontWeight: 800, letterSpacing: 0.4,
              boxShadow: "0 0 14px rgba(253,189,16,0.55), 0 2px 8px rgba(0,0,0,0.25)",
              transition: "all .2s", flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.borderColor = "white";
              e.currentTarget.style.boxShadow = "0 0 22px rgba(253,189,16,0.8), 0 4px 12px rgba(0,0,0,0.3)";
              e.currentTarget.style.transform = "scale(1.06)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "var(--u-gold)";
              e.currentTarget.style.borderColor = "var(--u-gold)";
              e.currentTarget.style.boxShadow = "0 0 14px rgba(253,189,16,0.55), 0 2px 8px rgba(0,0,0,0.25)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{lang === "en" ? "🇲🇽" : "🇺🇸"}</span>
            <span>{lang === "en" ? "ES" : "EN"}</span>
          </button>
        </div>
      </div>

      {/* AI Chat Widget */}
      <div style={{
        padding: "12px 14px",
        borderTop: "1px solid rgba(255,255,255,.08)",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        background: "rgba(0,0,0,0.25)",
        backdropFilter: "blur(8px)",
      }}>
        {/* Section label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--u-gold)", boxShadow: "0 0 6px rgba(253,189,16,0.8)" }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,.45)", textTransform: "uppercase" }}>
            {lang === "en" ? "AI Quick Assistant" : "Asistente IA Rápido"}
          </span>
        </div>

        {/* Messages */}
        <div style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, marginBottom: 9 }}>
          {chatMessages.length === 0 && (
            <div style={{
              fontSize: 12, color: "rgba(255,255,255,.65)", lineHeight: 1.55,
              padding: "9px 11px", background: "rgba(255,255,255,.07)",
              borderRadius: 10, border: "1px solid rgba(255,255,255,.1)",
            }}>
              ✨ {s.chatGreeting}
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i}>
              <div style={{
                fontSize: 12, lineHeight: 1.55, padding: "8px 11px", borderRadius: 10,
                background: msg.role === "user" ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)",
                color: "white",
                border: msg.role === "assistant" ? "1px solid rgba(255,255,255,.1)" : "none",
                textAlign: msg.role === "user" ? "right" : "left",
              }}>
                {msg.content}
                {msg.streaming && (
                  <span style={{ display: "inline-block", width: 1.5, height: "0.85em", background: "rgba(255,255,255,0.8)", marginLeft: 2, verticalAlign: "text-bottom", animation: "caretBlink 0.8s step-end infinite" }} />
                )}
              </div>
              {/* Navigation action button */}
              {msg.navTo && (
                <button
                  onClick={() => onNavigate(msg.navTo)}
                  style={{
                    marginTop: 5, width: "100%", padding: "6px 10px",
                    background: "rgba(253,189,16,0.15)", border: "1px solid rgba(253,189,16,0.4)",
                    borderRadius: 8, color: "var(--u-gold)", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", textAlign: "left", transition: "all .15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(253,189,16,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(253,189,16,0.15)"}
                >
                  → {s.chatGoTo}: {navLabels[msg.navTo]}
                </button>
              )}
              {/* SOP action button */}
              {msg.sopId && (() => {
                const sop = SOP_DATA.find(d => d.id === msg.sopId);
                return sop ? (
                  <button
                    onClick={() => onSelectSOP(sop)}
                    style={{
                      marginTop: 5, width: "100%", padding: "6px 10px",
                      background: "rgba(253,189,16,0.15)", border: "1px solid rgba(253,189,16,0.4)",
                      borderRadius: 8, color: "var(--u-gold)", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", textAlign: "left", transition: "all .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(253,189,16,0.25)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(253,189,16,0.15)"}
                  >
                    → {s.chatOpenSop}: {sop.short}
                  </button>
                ) : null;
              })()}
            </div>
          ))}
          {chatLoading && (
            <div style={{ display: "flex", gap: 4, padding: "8px 11px", background: "rgba(255,255,255,.07)", borderRadius: 10, width: "fit-content" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,.45)", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {quickChips.map(chip => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.text)}
              disabled={chatLoading}
              style={{
                fontSize: 11, padding: "4px 9px",
                border: "1px solid rgba(255,255,255,.2)", borderRadius: 16,
                background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.85)",
                cursor: chatLoading ? "not-allowed" : "pointer", transition: "all .15s",
                opacity: chatLoading ? 0.5 : 1,
              }}
              onMouseEnter={e => !chatLoading && (e.currentTarget.style.background = "rgba(255,255,255,.16)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage(chatInput)}
            placeholder={s.chatPlaceholder}
            style={{
              flex: 1, padding: "8px 12px",
              background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)",
              borderRadius: 20, color: "white", fontSize: 12, outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => sendMessage(chatInput)}
            disabled={!chatInput.trim() || chatLoading}
            style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: chatInput.trim() && !chatLoading ? "var(--u-gold)" : "rgba(255,255,255,.1)",
              border: "none", cursor: chatInput.trim() && !chatLoading ? "pointer" : "not-allowed",
              color: chatInput.trim() && !chatLoading ? "var(--u-navy-d)" : "rgba(255,255,255,.3)",
              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .2s",
              boxShadow: chatInput.trim() && !chatLoading ? "0 0 8px rgba(253,189,16,0.4)" : "none",
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: "12px 18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={() => onNavigate("home")} style={{ width: "100%", padding: "12px 16px", background: activePage === "home" ? "var(--u-gold)" : "rgba(255,255,255,.05)", border: "none", borderRadius: 10, color: activePage === "home" ? "var(--u-navy-d)" : "white", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left", transition: "all .2s", boxShadow: activePage === "home" ? "0 4px 12px rgba(253,189,16,0.3)" : "" }}>
          {s.dashboard}
        </button>
        <button onClick={() => onNavigate("violations")} style={{ width: "100%", padding: "12px 16px", background: activePage === "violations" ? "var(--u-gold)" : "rgba(255,255,255,.03)", border: activePage === "violations" ? "none" : "1px solid rgba(255,255,255,0.05)", borderRadius: 10, color: activePage === "violations" ? "var(--u-navy-d)" : "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left", transition: "all .2s" }}>
          {s.violations}
        </button>
        <button onClick={() => onNavigate("economic")} style={{ width: "100%", padding: "12px 16px", background: activePage === "economic" ? "var(--u-gold)" : "rgba(255,255,255,.03)", border: activePage === "economic" ? "none" : "1px solid rgba(255,255,255,0.05)", borderRadius: 10, color: activePage === "economic" ? "var(--u-navy-d)" : "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left", transition: "all .2s" }}>
          {s.economic}
        </button>
        <button onClick={onOpenProfile} style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, color: "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 14, textAlign: "left", transition: "all .2s" }}>
          {farmProfile?.farm_name ? farmProfile.farm_name.slice(0, 22) : (lang === "es" ? "Mi Perfil de Granja" : "My Farm Profile")}
        </button>
      </div>

      {/* SOP List */}
      <div style={{ padding: "12px 18px 6px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,.45)", padding: "0 6px", marginBottom: 8 }}>{s.procedures}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 24px" }}>
        {localizedSops.map(sop => (
          <button key={sop.id} onClick={() => onSelectSOP(SOP_DATA.find(d => d.id === sop.id))}
            style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", marginBottom: 4, background: activeSOP?.id === sop.id ? "rgba(255,255,255,.2)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", color: "white", transition: "all .15s" }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{sop.icon}</span>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: activeSOP?.id === sop.id ? "white" : "rgba(255,255,255,.8)", fontWeight: activeSOP?.id === sop.id ? 600 : 400 }}>{sop.short}</span>
          </button>
        ))}
      </div>

      {/* User / Sign out */}
      <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,.15)" }}>
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "var(--u-gold)", color: "var(--u-navy-d)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700,
            }}>
              {currentUser.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.organization}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          style={{
            width: "100%", padding: "8px 12px", background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 8,
            color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 12,
            fontWeight: 500, textAlign: "center", transition: "all .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.color = "rgba(255,255,255,.6)"; }}
        >
          {s.signOut}
        </button>
      </div>
    </div>
  );
}
