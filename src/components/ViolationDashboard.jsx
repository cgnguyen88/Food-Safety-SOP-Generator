import { useState, useMemo } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { SEVERITY_LEVELS } from "../data/cost-defaults.js";
import IncidentLogForm from "./IncidentLogForm.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr);
  const month = d.toLocaleString("default", { month: "short" });
  const day = d.getDate();
  return `${month} ${day}`;
}

function groupByWeek(incidents) {
  const weeks = {};
  incidents.forEach(inc => {
    const d = new Date(inc.date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(inc);
  });
  return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, items]) => ({
    weekStart,
    label: getWeekLabel(weekStart),
    count: items.length,
    bySeverity: {
      critical: items.filter(i => i.severity === "critical").length,
      high: items.filter(i => i.severity === "high").length,
      medium: items.filter(i => i.severity === "medium").length,
      low: items.filter(i => i.severity === "low").length,
    },
  }));
}

export default function ViolationDashboard({ incidents, onAddIncident, onUpdateIncident, onDeleteIncident }) {
  const { lang } = useLanguage();
  const v = T[lang].violations;

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(daysAgo(0));
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() =>
    incidents.filter(i => i.date >= startDate && i.date <= endDate).sort((a, b) => b.date.localeCompare(a.date)),
    [incidents, startDate, endDate]
  );

  const stats = useMemo(() => ({
    total: filtered.length,
    critical: filtered.filter(i => i.severity === "critical").length,
    resolvedPct: filtered.length ? Math.round((filtered.filter(i => i.resolved).length / filtered.length) * 100) : 0,
    avgDowntime: filtered.length ? (filtered.reduce((s, i) => s + (i.downtimeHours || 0), 0) / filtered.length).toFixed(1) : "0",
  }), [filtered]);

  const weeklyData = useMemo(() => groupByWeek(filtered), [filtered]);
  const maxWeekCount = Math.max(...weeklyData.map(w => w.count), 1);

  const handleSave = (inc) => {
    if (editingIncident) {
      onUpdateIncident(inc.id, inc);
    } else {
      onAddIncident(inc);
    }
    setShowForm(false);
    setEditingIncident(null);
  };

  const handleDelete = (id) => {
    onDeleteIncident(id);
    setConfirmDelete(null);
  };

  const presets = [
    { label: v.days7, days: 7 },
    { label: v.days30, days: 30 },
    { label: v.days90, days: 90 },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "Lora,serif", fontSize: 32, color: "var(--u-navy)", fontWeight: 800, letterSpacing: "-0.02em" }}>{v.title}</h1>
          <p style={{ fontSize: 15, color: "var(--txt3)", marginTop: 6 }}>{v.subtitle}</p>
        </div>
        <button onClick={() => { setEditingIncident(null); setShowForm(true); }}
          style={{ padding: "14px 28px", background: "var(--u-navy)", color: "white", border: "none", borderRadius: 14, cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,45,84,0.3)" }}>
          {v.logIncident}
        </button>
      </div>

      {/* Date Range */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--bdr)", borderRadius: 8, fontSize: 13, outline: "none" }} />
        <span style={{ color: "var(--txt3)", fontSize: 13 }}>{v.to}</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--bdr)", borderRadius: 8, fontSize: 13, outline: "none" }} />
        {presets.map(p => (
          <button key={p.label} onClick={() => { setStartDate(daysAgo(p.days)); setEndDate(daysAgo(0)); }}
            style={{ padding: "7px 14px", border: "1px solid var(--bdr)", borderRadius: 20, background: "white", cursor: "pointer", fontSize: 12, color: "var(--txt2)" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { icon: "📊", label: v.totalViolations, value: stats.total, color: "var(--u-navy)" },
          { icon: "🔴", label: v.critical, value: stats.critical, color: "#991b1b" },
          { icon: "✅", label: v.resolved, value: `${stats.resolvedPct}%`, color: "var(--u-navy-l)" },
          { icon: "⏱️", label: v.avgDowntime, value: `${stats.avgDowntime}h`, color: "var(--gold)" },
        ].map(card => (
          <div key={card.label} className="glass" style={{ padding: "24px", borderRadius: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: "var(--txt3)", marginTop: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      {weeklyData.length > 0 && (
        <div className="glass" style={{ borderRadius: 20, padding: "24px 32px", marginBottom: 32 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--u-navy)", marginBottom: 20, textTransform: "uppercase", letterSpacing: 1 }}>{v.weeklyTrends}</h3>
          {weeklyData.map(week => (
            <div key={week.weekStart} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <span style={{ width: 70, fontSize: 13, color: "var(--txt2)", textAlign: "right", flexShrink: 0, fontWeight: 600 }}>{week.label}</span>
              <div style={{ flex: 1, height: 32, background: "rgba(0,0,0,0.05)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.max((week.count / maxWeekCount) * 100, 8)}%`, height: "100%",
                  background: week.bySeverity.critical > 0 ? "#991b1b" : week.bySeverity.high > 0 ? "#dc2626" : "var(--u-navy)",
                  borderRadius: 8, display: "flex", alignItems: "center", paddingLeft: 10, transition: "width .5s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}>
                  <span style={{ color: "white", fontSize: 13, fontWeight: 800 }}>{week.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incidents Table */}
      <div style={{ background: "white", border: "1.5px solid var(--bdr2)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bdr2)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--g900)" }}>{v.incidentLog} ({filtered.length})</h3>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--txt3)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14 }}>{v.noIncidents}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{v.noIncidentsHint}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--cream)" }}>
                  {[v.tableDate, v.tableSOP, v.tableType, v.tableSeverity, v.tableDowntime, v.tableStatus, v.tableActions].map(h =>
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--txt2)", fontSize: 12, borderBottom: "1px solid var(--bdr2)" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inc => (
                  <tr key={inc.id} style={{ borderBottom: "1px solid var(--bdr2)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{inc.date}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.sopName}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{inc.violationType}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: SEVERITY_LEVELS[inc.severity]?.color + "20", color: SEVERITY_LEVELS[inc.severity]?.color
                      }}>
                        {SEVERITY_LEVELS[inc.severity]?.icon} {inc.severity}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{inc.downtimeHours || 0}h</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{inc.resolved ? v.statusResolved : v.statusOpen}</td>
                    <td style={{ padding: "10px 12px", display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditingIncident(inc); setShowForm(true); }}
                        style={{ padding: "4px 10px", border: "1px solid var(--bdr)", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 11 }}>{v.edit}</button>
                      {confirmDelete === inc.id ? (
                        <>
                          <button onClick={() => handleDelete(inc.id)}
                            style={{ padding: "4px 10px", border: "none", borderRadius: 6, background: "var(--red)", color: "white", cursor: "pointer", fontSize: 11 }}>{v.confirm}</button>
                          <button onClick={() => setConfirmDelete(null)}
                            style={{ padding: "4px 8px", border: "1px solid var(--bdr)", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 11 }}>{v.cancel}</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(inc.id)}
                          style={{ padding: "4px 10px", border: "1px solid #fca5a5", borderRadius: 6, background: "var(--red-l)", cursor: "pointer", fontSize: 11, color: "var(--red)" }}>{v.delete}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Form Modal */}
      {showForm && (
        <IncidentLogForm
          incident={editingIncident}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingIncident(null); }}
        />
      )}
    </div>
  );
}
