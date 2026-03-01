import { useState, useMemo } from "react";
import { SOP_DATA } from "../data/sop-data.js";
import { calculateEconomicImpact, parseProductWeight, CORRECTIVE_COST_TYPES } from "../data/cost-defaults.js";
import CostSettingsModal from "./CostSettingsModal.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function daysBetween(start, end) {
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
}

export default function EconomicReport({ incidents, costSettings, onSaveCostSettings }) {
  const { lang } = useLanguage();
  const ec = T[lang].economic;

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(daysAgo(0));
  const [showSettings, setShowSettings] = useState(false);

  const filtered = useMemo(() =>
    incidents.filter(i => i.date >= startDate && i.date <= endDate),
    [incidents, startDate, endDate]
  );

  const impact = useMemo(() => calculateEconomicImpact(filtered, costSettings), [filtered, costSettings]);

  const totalDowntimeHrs = filtered.reduce((s, i) => s + (i.downtimeHours || 0), 0);
  const overrideCount = filtered.filter(i => i.downtimeCostOverride > 0).length;
  const totalWeight = filtered.reduce((s, i) => s + parseProductWeight(i.affectedProduct), 0);
  const days = daysBetween(startDate, endDate);

  // Group by SOP
  const bySop = useMemo(() => {
    const groups = {};
    filtered.forEach(inc => {
      if (!groups[inc.sopId]) groups[inc.sopId] = { sopId: inc.sopId, sopName: inc.sopName || "Unknown", incidents: [] };
      groups[inc.sopId].incidents.push(inc);
    });
    return Object.values(groups).map(g => {
      const grpImpact = calculateEconomicImpact(g.incidents, costSettings);
      return { ...g, count: g.incidents.length, totalCost: grpImpact.total, avgCost: grpImpact.total / g.incidents.length };
    }).sort((a, b) => b.totalCost - a.totalCost);
  }, [filtered, costSettings]);

  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const presets = [
    { label: T[lang].violations.days7, days: 7 },
    { label: T[lang].violations.days30, days: 30 },
    { label: T[lang].violations.days90, days: 90 },
  ];

  const exportCSV = () => {
    const headers = ["Date", "SOP", "Violation Type", "Severity", "Downtime (hrs)", "Downtime Cost (Actual)", "Affected Product", "Downtime Cost", "Product Loss", "Corrective Cost", "Corrective: Retraining", "Corrective: Testing", "Corrective: Equipment", "Corrective: Labor", "Corrective: Other"];
    const rows = filtered.map(inc => {
      const dtCost = inc.downtimeCostOverride > 0
        ? inc.downtimeCostOverride
        : (inc.downtimeHours || 0) * costSettings.laborHourlyRate;
      const prodCost = parseProductWeight(inc.affectedProduct) * costSettings.produceCostPerLb;
      const byType = { retraining: 0, testing: 0, equipment: 0, labor: 0, other: 0 };
      let corrCost = 0;
      if (inc.correctiveCosts && inc.correctiveCosts.length > 0) {
        inc.correctiveCosts.forEach(c => {
          const amt = c.cost || 0;
          corrCost += amt;
          if (byType[c.type] !== undefined) byType[c.type] += amt;
          else byType.other += amt;
        });
      } else {
        if (inc.severity === "high" || inc.severity === "critical") { corrCost += costSettings.retrainingSessionCost; byType.retraining += costSettings.retrainingSessionCost; }
        if (inc.sopId === 4 || inc.sopId === 5) { corrCost += costSettings.testingCost; byType.testing += costSettings.testingCost; }
      }
      return [inc.date, inc.sopName, inc.violationType, inc.severity, inc.downtimeHours || 0, inc.downtimeCostOverride > 0 ? "Yes" : "Auto", inc.affectedProduct || "", dtCost.toFixed(2), prodCost.toFixed(2), corrCost.toFixed(2), byType.retraining.toFixed(2), byType.testing.toFixed(2), byType.equipment.toFixed(2), byType.labor.toFixed(2), byType.other.toFixed(2)];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `economic_report_${startDate}_to_${endDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "Lora,serif", fontSize: 32, color: "var(--u-navy)", fontWeight: 800, letterSpacing: "-0.02em" }}>{ec.title}</h1>
          <p style={{ fontSize: 15, color: "var(--txt3)", marginTop: 6 }}>{ec.incidentsAnalyzed(filtered.length, days)}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setShowSettings(true)}
            style={{ padding: "12px 20px", border: "1.5px solid var(--u-navy)", borderRadius: 12, background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--u-navy)" }}>
            {ec.costSettings}
          </button>
          <button onClick={exportCSV}
            style={{ padding: "12px 24px", background: "var(--u-navy)", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,45,84,0.3)" }}>
            {ec.exportCSV}
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--bdr)", borderRadius: 8, fontSize: 13, outline: "none" }} />
        <span style={{ color: "var(--txt3)", fontSize: 13 }}>{T[lang].violations.to}</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ padding: "7px 12px", border: "1.5px solid var(--bdr)", borderRadius: 8, fontSize: 13, outline: "none" }} />
        {presets.map(p => (
          <button key={p.label} onClick={() => { setStartDate(daysAgo(p.days)); setEndDate(daysAgo(0)); }}
            style={{ padding: "7px 14px", border: "1px solid var(--bdr)", borderRadius: 20, background: "white", cursor: "pointer", fontSize: 12, color: "var(--txt2)" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Total Impact Card */}
      <div className="glass" style={{ padding: "40px", borderRadius: 24, textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 14, color: "var(--txt3)", marginBottom: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{ec.totalLoss}</div>
        <div style={{ fontSize: 56, fontWeight: 900, color: impact.total > 0 ? "#991b1b" : "var(--u-navy)", letterSpacing: "-0.04em" }}>
          ${fmt(impact.total)}
        </div>
        <div style={{ fontSize: 15, color: "var(--txt2)", marginTop: 12, fontWeight: 500 }}>
          {ec.downtimeHrs(totalDowntimeHrs.toFixed(1))} — {totalWeight > 0 ? ec.lbsProductLoss(totalWeight) : ec.noProductLoss}
        </div>
      </div>

      {/* Breakdown Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 32 }}>
        {[
          {
            icon: "⏱️", label: ec.processing, amount: impact.downtimeCost,
            detail: overrideCount > 0
              ? ec.downtimeDetailOverride(totalDowntimeHrs.toFixed(1), overrideCount)
              : `${totalDowntimeHrs.toFixed(1)} hours at $${costSettings.downtimeHourlyRate ?? costSettings.laborHourlyRate}/hr`,
          },
          {
            icon: "🗑️", label: ec.productLoss, amount: impact.productLossCost,
            detail: totalWeight > 0 ? `${totalWeight} lbs at $${costSettings.produceCostPerLb}/lb` : ec.noProductRecorded,
          },
          {
            icon: "🔧", label: ec.correctiveActions, amount: impact.correctiveActionCost,
            detail: ec.correctiveDetail,
            breakdown: impact.correctiveByType,
          },
        ].map(card => (
          <div key={card.label} className="glass" style={{ padding: "28px", borderRadius: 22 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--u-navy)" }}>${fmt(card.amount)}</div>
            {impact.total > 0 && (
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--u-navy-l)", marginTop: 4 }}>
                {((card.amount / impact.total) * 100).toFixed(1)}%
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--txt3)", marginTop: 10, lineHeight: 1.5 }}>{card.detail}</div>
            {card.breakdown && card.amount > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--bdr2)", paddingTop: 12 }}>
                {CORRECTIVE_COST_TYPES.filter(t => card.breakdown[t.id] > 0).map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--txt2)", display: "flex", gap: 6 }}>
                      <span>{t.icon}</span>
                      <span>{ec.correctiveCostTypes ? ec.correctiveCostTypes[t.id] : t.id}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--u-navy)" }}>${fmt(card.breakdown[t.id])}</span>
                  </div>
                ))}
              </div>
            )}
            {card.breakdown && card.amount === 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--txt3)", fontStyle: "italic" }}>
                Log corrective action costs when reporting incidents.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* By Category Table */}
      {bySop.length > 0 && (
        <div style={{ background: "white", border: "1.5px solid var(--bdr2)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bdr2)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--g900)" }}>{ec.costBySop}</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--cream)" }}>
                  {[ec.colCategory, ec.colIncidents, ec.colTotal, ec.colAvg, ec.colPct].map(h =>
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--txt2)", fontSize: 12, borderBottom: "1px solid var(--bdr2)" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {bySop.map(row => (
                  <tr key={row.sopId} style={{ borderBottom: "1px solid var(--bdr2)" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>{row.sopName}</td>
                    <td style={{ padding: "10px 14px" }}>{row.count}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>${fmt(row.totalCost)}</td>
                    <td style={{ padding: "10px 14px" }}>${fmt(row.avgCost)}</td>
                    <td style={{ padding: "10px 14px" }}>{impact.total > 0 ? ((row.totalCost / impact.total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--txt3)" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: 16, fontWeight: 500 }}>{ec.noData}</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>{ec.noDataHint}</p>
        </div>
      )}

      {showSettings && (
        <CostSettingsModal
          settings={costSettings}
          onSave={(s) => { onSaveCostSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
