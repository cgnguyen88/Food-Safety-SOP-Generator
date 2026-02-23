import { useState, useRef, useEffect } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { SEVERITY_LEVELS } from "../data/cost-defaults.js";

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

export default function Sidebar({ activeSOP, activePage, onSelectSOP, onOpenProfile, onNavigate, farmProfile, incidents }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

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
    <div style={{ width:240,background:"var(--g950)",color:"white",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
      <div style={{ padding:"24px 20px 18px",borderBottom:"1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontFamily:"Lora,serif",fontSize:17,fontWeight:600,lineHeight:1.2 }}>FarmSafe</div>
        <div style={{ fontSize:11,color:"rgba(255,255,255,.5)",marginTop:3 }}>FSMA PSR Compliance System</div>
      </div>

      {/* Search Bar */}
      <div ref={containerRef} style={{ padding:"12px 12px 8px",position:"relative" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"rgba(255,255,255,.35)",pointerEvents:"none" }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search..."
            style={{
              width:"100%",padding:"8px 10px 8px 30px",
              background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",
              borderRadius:8,color:"white",fontSize:12,outline:"none",
              fontFamily:"'IBM Plex Sans',sans-serif",
            }}
          />
          {!query && (
            <span style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:10,color:"rgba(255,255,255,.25)",pointerEvents:"none",
              padding:"2px 5px",border:"1px solid rgba(255,255,255,.15)",borderRadius:4 }}>
              ⌘K
            </span>
          )}
          {query && (
            <button onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              style={{ position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:14,lineHeight:1 }}>
              ✕
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div style={{
            position:"absolute",left:12,right:12,top:"100%",marginTop:4,
            background:"#1a2e1a",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,
            boxShadow:"0 8px 24px rgba(0,0,0,.4)",zIndex:100,maxHeight:360,overflowY:"auto",
          }}>
            {results.length === 0 ? (
              <div style={{ padding:"16px",textAlign:"center",color:"rgba(255,255,255,.4)",fontSize:12 }}>
                No results for "{query}"
              </div>
            ) : (
              results.map((r, i) => (
                <button
                  key={`${r.type}-${i}`}
                  onClick={() => handleSelect(r)}
                  style={{
                    width:"100%",display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",
                    background:"transparent",border:"none",borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                    cursor:"pointer",textAlign:"left",color:"white",transition:"background .1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize:16,flexShrink:0,marginTop:1 }}>{r.icon}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:500,color:"white",lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      <span style={{
                        display:"inline-block",padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600,marginRight:4,
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
      <div style={{ padding:"4px 12px 8px",display:"flex",flexDirection:"column",gap:4 }}>
        <button onClick={()=>onNavigate("home")} style={{ width:"100%",padding:"9px 12px",background:activePage==="home"?"rgba(255,255,255,.15)":"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",borderRadius:8,color:"white",cursor:"pointer",fontSize:12,fontWeight:500,textAlign:"left" }}>
          Dashboard
        </button>
        <button onClick={()=>onNavigate("violations")} style={{ width:"100%",padding:"9px 12px",background:activePage==="violations"?"rgba(255,255,255,.15)":"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,color:activePage==="violations"?"white":"rgba(255,255,255,.7)",cursor:"pointer",fontSize:12,textAlign:"left" }}>
          Violation Dashboard
        </button>
        <button onClick={()=>onNavigate("economic")} style={{ width:"100%",padding:"9px 12px",background:activePage==="economic"?"rgba(255,255,255,.15)":"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,color:activePage==="economic"?"white":"rgba(255,255,255,.7)",cursor:"pointer",fontSize:12,textAlign:"left" }}>
          Economic Report
        </button>
        <button onClick={onOpenProfile} style={{ width:"100%",padding:"9px 12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:12,textAlign:"left" }}>
          {farmProfile?.farm_name ? farmProfile.farm_name.slice(0,22) : "My Farm Profile"}
        </button>
      </div>
      <div style={{ padding:"8px 12px 4px" }}>
        <div style={{ fontSize:10,fontWeight:600,letterSpacing:1,color:"rgba(255,255,255,.35)",padding:"0 6px",marginBottom:6 }}>STANDARD PROCEDURES</div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"0 12px 20px" }}>
        {SOP_DATA.map(sop => (
          <button key={sop.id} onClick={()=>onSelectSOP(sop)}
            style={{ width:"100%",display:"flex",alignItems:"flex-start",gap:8,padding:"9px 10px",marginBottom:3,background:activeSOP?.id===sop.id?"rgba(255,255,255,.15)":"transparent",border:activeSOP?.id===sop.id?"1px solid rgba(255,255,255,.2)":"1px solid transparent",borderRadius:8,cursor:"pointer",textAlign:"left",color:"white",transition:"all .1s" }}>
            <span style={{ fontSize:14,flexShrink:0,marginTop:1 }}>{sop.icon}</span>
            <span style={{ fontSize:11.5,lineHeight:1.4,color:activeSOP?.id===sop.id?"white":"rgba(255,255,255,.65)",fontWeight:activeSOP?.id===sop.id?600:400 }}>{sop.short}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,.08)",fontSize:10,color:"rgba(255,255,255,.3)",lineHeight:1.4 }}>
        FDA FSMA PSR Compliant<br/>Templates v1.0
      </div>
    </div>
  );
}
