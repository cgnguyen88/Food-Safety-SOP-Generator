import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { SOP_DATA } from "../data/sop-data.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

export default function Sidebar({ activeSOP, activePage, onSelectSOP, onOpenProfile, onNavigate, onLogout, currentUser, farmProfile }) {
  const { lang, toggleLang } = useLanguage();
  const s = T[lang].sidebar;

  const localizedSops = SOP_DATA.map(sop => getLocalizedSop(sop, lang));

  // ── Search state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Build a flat list of searchable items: pages + SOPs
  const pages = [
    { type: "page", icon: "🏠", label: s.dashboard,  page: "home" },
    { type: "page", icon: "📋", label: s.violations,  page: "violations" },
    { type: "page", icon: "📊", label: s.economic,    page: "economic" },
  ];
  const sopItems = localizedSops.map(sop => ({
    type: "sop", icon: sop.icon, label: sop.short, desc: sop.desc?.slice(0, 60), sopId: sop.id,
  }));
  const allItems = [...pages, ...sopItems];

  const results = query.trim()
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.desc?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelect = (item) => {
    if (item.type === "page") onNavigate(item.page);
    else onSelectSOP(SOP_DATA.find(d => d.id === item.sopId));
    setQuery("");
    setIsFocused(false);
  };

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

      {/* Search Bar */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.08)", position: "relative" }}>
        <motion.div
          animate={{ scale: isFocused ? 1.02 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {/* Input wrapper */}
          <motion.div
            animate={{
              boxShadow: isFocused
                ? "0 0 0 2px rgba(253,189,16,0.6), 0 8px 24px rgba(0,0,0,0.35)"
                : "0 0 0 1px rgba(255,255,255,0.1)",
            }}
            transition={{ duration: 0.2 }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: isFocused ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)",
              borderRadius: 24, padding: "0 12px", transition: "background .2s",
            }}
          >
            <Search size={15} color={isFocused ? "var(--u-gold)" : "rgba(255,255,255,0.45)"} style={{ flexShrink: 0, transition: "color .2s" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              placeholder={lang === "en" ? "Search SOPs, pages…" : "Buscar POEs, páginas…"}
              style={{
                flex: 1, padding: "9px 0", background: "transparent",
                border: "none", outline: "none", color: "white",
                fontSize: 13, fontFamily: "inherit",
              }}
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  onClick={() => setQuery("")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.4)", fontSize: 16, lineHeight: 1,
                    padding: 0, display: "flex", alignItems: "center", flexShrink: 0,
                  }}
                >
                  ×
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Results dropdown */}
        <AnimatePresence>
          {isFocused && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "absolute", left: 14, right: 14, top: "100%",
                marginTop: 6, zIndex: 200,
                background: "rgba(0,18,40,0.97)",
                border: "1px solid rgba(253,189,16,0.25)",
                borderRadius: 12, overflow: "hidden",
                boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
                backdropFilter: "blur(12px)",
              }}
            >
              {results.map((item, i) => (
                <motion.button
                  key={item.type + (item.page || item.sopId)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleSelect(item)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 14px", background: "transparent", border: "none",
                    borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    cursor: "pointer", textAlign: "left", transition: "background .12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(253,189,16,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label}
                    </div>
                    {item.desc && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                        {item.desc}
                      </div>
                    )}
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(253,189,16,0.6)", flexShrink: 0, fontWeight: 600, textTransform: "uppercase" }}>
                    {item.type === "page" ? (lang === "en" ? "Page" : "Página") : "SOP"}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
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
