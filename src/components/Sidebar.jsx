import { useState, useRef, useEffect } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { SEVERITY_LEVELS } from "../data/cost-defaults.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

function searchAll(query, incidents) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results = [];

  // Search SOPs — title, short, desc, ref, tag
  SOP_DATA.forEach(sop => {
    const titleMatch = sop.title.toLowerCase().includes(q) || sop.short.toLowerCase().includes(q);
    const descMatch = sop.desc.toLowerCase().includes(q);
    const refMatch = sop.ref.toLowerCase().includes(q);
    const tagMatch = sop.tag.toLowerCase().includes(q);

    if (titleMatch || descMatch || refMatch || tagMatch) {
      results.push({ type: "sop", icon: sop.icon, title: sop.title, subtitle: sop.tag, data: sop });
    }

    // Search within SOP sections and fields
    sop.sections.forEach(section => {
      const sectionMatch = section.title.toLowerCase().includes(q);
      if (sectionMatch && !titleMatch) {
        results.push({ type: "sop-section", icon: sop.icon, title: section.title, subtitle: `${sop.short}`, data: sop });
      }
      section.fields.forEach(field => {
        if (field.label.toLowerCase().includes(q) && !titleMatch && !sectionMatch) {
          results.push({ type: "sop-field", icon: "📝", title: field.label, subtitle: `${sop.short} > ${section.title}`, data: sop });
        }
      });
    });

    // Search log template
    if (sop.log.title.toLowerCase().includes(q)) {
      results.push({ type: "sop-log", icon: "📋", title: sop.log.title, subtitle: sop.short, data: sop });
    }
  });

  // Search incidents/violations
  if (incidents && incidents.length > 0) {
    incidents.forEach(inc => {
      const matches =
        (inc.description || "").toLowerCase().includes(q) ||
        (inc.violationType || "").toLowerCase().includes(q) ||
        (inc.sopName || "").toLowerCase().includes(q) ||
        (inc.correctiveAction || "").toLowerCase().includes(q) ||
        (inc.affectedProduct || "").toLowerCase().includes(q);

      if (matches) {
        results.push({
          type: "incident",
          icon: SEVERITY_LEVELS[inc.severity]?.icon || "⚠️",
          title: inc.violationType || inc.description?.slice(0, 50) || "Incident",
          subtitle: `${inc.date} — ${inc.sopName || "Unknown SOP"}`,
          data: inc,
        });
      }
    });
  }

  // Search pages
  const pages = [
    { name: "Dashboard", page: "home", desc: "SOP templates and overview" },
    { name: "Violation Dashboard", page: "violations", desc: "Track and log incidents" },
    { name: "Economic Report", page: "economic", desc: "Cost impact analysis" },
    { name: "Farm Profile", page: "profile", desc: "Farm information and settings" },
  ];
  pages.forEach(p => {
    if (p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) {
      results.push({ type: "page", icon: "📄", title: p.name, subtitle: p.desc, data: p });
    }
  });

  // Deduplicate SOPs (keep first match only)
  const seen = new Set();
  return results.filter(r => {
    if (r.type === "sop" || r.type === "sop-section" || r.type === "sop-field" || r.type === "sop-log") {
      const key = `sop-${r.data.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  }).slice(0, 12);
}

export default function Sidebar({ activeSOP, activePage, onSelectSOP, onOpenProfile, onNavigate, onLogout, currentUser, farmProfile, incidents }) {
  const { lang, toggleLang } = useLanguage();
  const s = T[lang].sidebar;
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const localizedSops = SOP_DATA.map(sop => getLocalizedSop(sop, lang));
  const results = searchAll(query, incidents || []);
  const showResults = focused && query.length >= 2;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (result) => {
    setQuery("");
    setFocused(false);

    if (result.type === "sop" || result.type === "sop-section" || result.type === "sop-field" || result.type === "sop-log") {
      onSelectSOP(result.data);
    } else if (result.type === "incident") {
      onNavigate("violations");
    } else if (result.type === "page") {
      if (result.data.page === "profile") {
        onOpenProfile();
      } else {
        onNavigate(result.data.page);
      }
    }
  };

  // Keyboard shortcut: Ctrl/Cmd+K to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ width: 260, background: "var(--u-navy)", color: "white", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
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
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 20,
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(255,255,255,.1)",
              color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700,
              transition: "background .15s", flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.1)"}
          >
            {lang === "en" ? "🇲🇽 ES" : "🇺🇸 EN"}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div ref={containerRef} style={{ padding: "16px 24px 12px", position: "relative" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,.35)", pointerEvents: "none" }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={s.search}
            style={{
              width: "100%", padding: "12px 14px 12px 38px",
              background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 12, color: "white", fontSize: 14, outline: "none",
              fontFamily: "inherit", backdropFilter: "blur(8px)", transition: "all .2s",
            }}
          />
          {!query && (
            <span style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "rgba(255,255,255,.4)", pointerEvents: "none",
              padding: "2px 6px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 4
            }}>
              ⌘K
            </span>
          )}
          {query && (
            <button onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>
              ✕
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div style={{
            position: "absolute", left: 12, right: 12, top: "100%", marginTop: 4,
            background: "#1a2e1a", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.4)", zIndex: 100, maxHeight: 360, overflowY: "auto",
          }}>
            {results.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 12 }}>
                No results for "{query}"
              </div>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.type}-${i}`}
                  onClick={() => handleSelect(r)}
                  style={{
                    width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
                    background: "transparent", border: "none", borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                    cursor: "pointer", textAlign: "left", color: "white", transition: "background .1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "white", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{
                        display: "inline-block", padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, marginRight: 4,
                        background: r.type === "incident" ? "rgba(220,38,38,.2)" : r.type === "page" ? "rgba(255,255,255,.1)" : "rgba(22,163,74,.2)",
                        color: r.type === "incident" ? "#fca5a5" : r.type === "page" ? "rgba(255,255,255,.6)" : "#86efac",
                      }}>
                        {r.type === "sop" ? "SOP" : r.type === "sop-section" ? "Section" : r.type === "sop-field" ? "Field" : r.type === "sop-log" ? "Log" : r.type === "incident" ? "Violation" : "Page"}
                      </span>
                      {r.subtitle}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
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
      <div style={{ padding: "12px 18px 6px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,.45)", padding: "0 6px", marginBottom: 8 }}>{s.procedures}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 24px" }}>
        {localizedSops.map(sop => (
          <button key={sop.id} onClick={() => onSelectSOP(SOP_DATA.find(s => s.id === sop.id))}
            style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", marginBottom: 4, background: activeSOP?.id === sop.id ? "rgba(255,255,255,.2)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", color: "white", transition: "all .15s" }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{sop.icon}</span>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: activeSOP?.id === sop.id ? "white" : "rgba(255,255,255,.8)", fontWeight: activeSOP?.id === sop.id ? 600 : 400 }}>{sop.short}</span>
          </button>
        ))}
      </div>
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
