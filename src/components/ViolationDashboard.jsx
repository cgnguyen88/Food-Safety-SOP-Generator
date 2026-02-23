import { useState, useMemo } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { SEVERITY_LEVELS } from "../data/cost-defaults.js";
import IncidentLogForm from "./IncidentLogForm.jsx";

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
  return Object.entries(weeks).sort(([a],[b]) => a.localeCompare(b)).map(([weekStart, items]) => ({
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
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(daysAgo(0));
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() =>
    incidents.filter(i => i.date >= startDate && i.date <= endDate).sort((a,b) => b.date.localeCompare(a.date)),
    [incidents, startDate, endDate]
  );

  const stats = useMemo(() => ({
    total: filtered.length,
    critical: filtered.filter(i => i.severity === "critical").length,
    resolvedPct: filtered.length ? Math.round((filtered.filter(i => i.resolved).length / filtered.length) * 100) : 0,
    avgDowntime: filtered.length ? (filtered.reduce((s,i) => s + (i.downtimeHours||0), 0) / filtered.length).toFixed(1) : "0",
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
    { label: "7 Days", days: 7 },
    { label: "30 Days", days: 30 },
    { label: "90 Days", days: 90 },
  ];

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"32px 40px" }}>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"Lora,serif",fontSize:28,color:"var(--g950)" }}>Violation Dashboard</h1>
          <p style={{ fontSize:14,color:"var(--txt2)",marginTop:4 }}>Track and analyze SOP violations and food safety incidents</p>
        </div>
        <button onClick={()=>{setEditingIncident(null);setShowForm(true);}}
          style={{ padding:"10px 20px",background:"var(--g800)",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>
          + Log Incident
        </button>
      </div>

      {/* Date Range */}
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:24,flexWrap:"wrap" }}>
        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
          style={{ padding:"7px 12px",border:"1.5px solid var(--bdr)",borderRadius:8,fontSize:13,outline:"none" }} />
        <span style={{ color:"var(--txt3)",fontSize:13 }}>to</span>
        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
          style={{ padding:"7px 12px",border:"1.5px solid var(--bdr)",borderRadius:8,fontSize:13,outline:"none" }} />
        {presets.map(p => (
          <button key={p.label} onClick={()=>{setStartDate(daysAgo(p.days));setEndDate(daysAgo(0));}}
            style={{ padding:"7px 14px",border:"1px solid var(--bdr)",borderRadius:20,background:"white",cursor:"pointer",fontSize:12,color:"var(--txt2)" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        {[
          { icon:"📊", label:"Total Violations", value:stats.total, color:"var(--g900)" },
          { icon:"🔴", label:"Critical", value:stats.critical, color:"#991b1b" },
          { icon:"✅", label:"Resolved", value:`${stats.resolvedPct}%`, color:"var(--g700)" },
          { icon:"⏱️", label:"Avg Downtime", value:`${stats.avgDowntime}h`, color:"var(--gold)" },
        ].map(card => (
          <div key={card.label} style={{ padding:"20px",background:"white",border:"1.5px solid var(--bdr2)",borderRadius:12,textAlign:"center" }}>
            <div style={{ fontSize:24,marginBottom:6 }}>{card.icon}</div>
            <div style={{ fontSize:28,fontWeight:700,color:card.color }}>{card.value}</div>
            <div style={{ fontSize:12,color:"var(--txt3)",marginTop:4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      {weeklyData.length > 0 && (
        <div style={{ background:"white",border:"1.5px solid var(--bdr2)",borderRadius:12,padding:"20px 24px",marginBottom:24 }}>
          <h3 style={{ fontSize:14,fontWeight:600,color:"var(--g900)",marginBottom:16 }}>Violations by Week</h3>
          {weeklyData.map(week => (
            <div key={week.weekStart} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
              <span style={{ width:60,fontSize:12,color:"var(--txt2)",textAlign:"right",flexShrink:0 }}>{week.label}</span>
              <div style={{ flex:1,height:28,background:"var(--cream3)",borderRadius:4,overflow:"hidden" }}>
                <div style={{
                  width:`${Math.max((week.count/maxWeekCount)*100, 8)}%`,height:"100%",
                  background: week.bySeverity.critical > 0 ? "#991b1b" : week.bySeverity.high > 0 ? "#dc2626" : "#f59e0b",
                  borderRadius:4,display:"flex",alignItems:"center",paddingLeft:8,transition:"width .3s",
                }}>
                  <span style={{ color:"white",fontSize:12,fontWeight:600 }}>{week.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incidents Table */}
      <div style={{ background:"white",border:"1.5px solid var(--bdr2)",borderRadius:12,overflow:"hidden" }}>
        <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--bdr2)" }}>
          <h3 style={{ fontSize:14,fontWeight:600,color:"var(--g900)" }}>Incident Log ({filtered.length})</h3>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding:40,textAlign:"center",color:"var(--txt3)" }}>
            <div style={{ fontSize:32,marginBottom:12 }}>📋</div>
            <p style={{ fontSize:14 }}>No incidents recorded for this date range.</p>
            <p style={{ fontSize:12,marginTop:4 }}>Click "Log Incident" to add one.</p>
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
              <thead>
                <tr style={{ background:"var(--cream)" }}>
                  {["Date","SOP","Type","Severity","Downtime","Status","Actions"].map(h =>
                    <th key={h} style={{ padding:"10px 12px",textAlign:"left",fontWeight:600,color:"var(--txt2)",fontSize:12,borderBottom:"1px solid var(--bdr2)" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inc => (
                  <tr key={inc.id} style={{ borderBottom:"1px solid var(--bdr2)" }}>
                    <td style={{ padding:"10px 12px",fontSize:12 }}>{inc.date}</td>
                    <td style={{ padding:"10px 12px",fontSize:12,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{inc.sopName}</td>
                    <td style={{ padding:"10px 12px",fontSize:12 }}>{inc.violationType}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ padding:"3px 8px",borderRadius:12,fontSize:11,fontWeight:600,
                        background:SEVERITY_LEVELS[inc.severity]?.color+"20",color:SEVERITY_LEVELS[inc.severity]?.color }}>
                        {SEVERITY_LEVELS[inc.severity]?.icon} {inc.severity}
                      </span>
                    </td>
                    <td style={{ padding:"10px 12px",fontSize:12 }}>{inc.downtimeHours || 0}h</td>
                    <td style={{ padding:"10px 12px",fontSize:12 }}>{inc.resolved ? "Resolved" : "Open"}</td>
                    <td style={{ padding:"10px 12px",display:"flex",gap:6 }}>
                      <button onClick={()=>{setEditingIncident(inc);setShowForm(true);}}
                        style={{ padding:"4px 10px",border:"1px solid var(--bdr)",borderRadius:6,background:"white",cursor:"pointer",fontSize:11 }}>Edit</button>
                      {confirmDelete === inc.id ? (
                        <>
                          <button onClick={()=>handleDelete(inc.id)}
                            style={{ padding:"4px 10px",border:"none",borderRadius:6,background:"var(--red)",color:"white",cursor:"pointer",fontSize:11 }}>Confirm</button>
                          <button onClick={()=>setConfirmDelete(null)}
                            style={{ padding:"4px 8px",border:"1px solid var(--bdr)",borderRadius:6,background:"white",cursor:"pointer",fontSize:11 }}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={()=>setConfirmDelete(inc.id)}
                          style={{ padding:"4px 10px",border:"1px solid #fca5a5",borderRadius:6,background:"var(--red-l)",cursor:"pointer",fontSize:11,color:"var(--red)" }}>Delete</button>
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
          onClose={()=>{setShowForm(false);setEditingIncident(null);}}
        />
      )}
    </div>
  );
}
