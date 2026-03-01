export const DEFAULT_COST_SETTINGS = {
  downtimeHourlyRate: 50,
  laborHourlyRate: 25,
  produceCostPerLb: 2,
  retrainingSessionCost: 500,
  testingCost: 150,
  equipmentReplacementCost: 200,
};

export const COST_FIELDS = [
  { id: "downtimeHourlyRate", label: "Downtime Cost Rate", prefix: "$", suffix: "/hour", hint: "Total cost per hour of operation downtime (idle labor, lost production, equipment)" },
  { id: "laborHourlyRate", label: "Standard Labor Hourly Rate", prefix: "$", suffix: "/hour" },
  { id: "produceCostPerLb", label: "Average Produce Cost", prefix: "$", suffix: "/lb" },
  { id: "retrainingSessionCost", label: "Retraining Session Cost", prefix: "$", suffix: "" },
  { id: "testingCost", label: "Water/Product Testing Cost", prefix: "$", suffix: "/test" },
  { id: "equipmentReplacementCost", label: "Equipment Replacement Cost", prefix: "$", suffix: "" },
];

// Corrective action cost categories for per-incident tracking
export const CORRECTIVE_COST_TYPES = [
  { id: "retraining", icon: "🎓" },
  { id: "testing", icon: "🧪" },
  { id: "equipment", icon: "🔧" },
  { id: "labor", icon: "👷" },
  { id: "other", icon: "📋" },
];

export const SEVERITY_LEVELS = {
  low: { label: "Low", color: "#fbbf24", icon: "ℹ️" },
  medium: { label: "Medium", color: "#f59e0b", icon: "⚠️" },
  high: { label: "High", color: "#dc2626", icon: "🚨" },
  critical: { label: "Critical", color: "#991b1b", icon: "🔴" },
};

export const VIOLATION_TYPES = {
  1: ["Illness not reported", "Handwashing violation", "PPE violation", "Eating/drinking in restricted area", "Training not completed"],
  2: ["Unauthorized visitor access", "No sign-in record", "Hygiene briefing skipped", "Contractor without documentation"],
  3: ["Cleaning skipped", "Sanitizer concentration failure", "Equipment not sanitized", "Pre-op inspection missed"],
  4: ["Water assessment not current", "Risk level change unaddressed", "No corrective action plan"],
  5: ["Water test failure", "Sampling missed", "Chain-of-custody break", "Results exceed limits"],
  6: ["PHI violation", "Untreated manure used", "No supplier documentation", "Improper storage"],
  7: ["Animal intrusion — harvest continued", "No pre-harvest assessment", "No-harvest zone not established"],
  8: ["Pre-op inspection failed", "Tool contamination", "Temperature control failure", "Foreign material found"],
  9: ["Missing lot code", "Record gap", "Recall readiness failure", "Traceability break"],
  10: ["Stop-work criteria ignored", "Corrective action not documented", "Product released without approval", "Root cause not identified"],
};

export function parseProductWeight(str) {
  if (!str) return 0;
  const match = str.match(/(\d+\.?\d*)\s*(lbs?|pounds?|kg|kilos?)/i);
  return match ? parseFloat(match[1]) : 0;
}

export function calculateEconomicImpact(incidents, costSettings) {
  const breakdown = {
    downtimeCost: 0,
    productLossCost: 0,
    correctiveActionCost: 0,
    total: 0,
    correctiveByType: { retraining: 0, testing: 0, equipment: 0, labor: 0, other: 0 },
  };

  incidents.forEach(inc => {
    const downtimeRate = costSettings.downtimeHourlyRate ?? costSettings.laborHourlyRate;
    if (inc.downtimeCostOverride > 0) {
      // Use the manually entered actual cost instead of the auto-calculation
      breakdown.downtimeCost += inc.downtimeCostOverride;
    } else if (inc.downtimeHours) {
      breakdown.downtimeCost += inc.downtimeHours * downtimeRate;
    }
    const lbs = parseProductWeight(inc.affectedProduct);
    if (lbs > 0) {
      breakdown.productLossCost += lbs * costSettings.produceCostPerLb;
    }

    // Use actual per-incident corrective costs if logged, else fall back to heuristic
    if (inc.correctiveCosts && inc.correctiveCosts.length > 0) {
      inc.correctiveCosts.forEach(c => {
        const amount = c.cost || 0;
        breakdown.correctiveActionCost += amount;
        if (breakdown.correctiveByType[c.type] !== undefined) {
          breakdown.correctiveByType[c.type] += amount;
        } else {
          breakdown.correctiveByType.other += amount;
        }
      });
    } else {
      // Legacy heuristic for incidents logged before this feature
      if (inc.severity === "high" || inc.severity === "critical") {
        breakdown.correctiveActionCost += costSettings.retrainingSessionCost;
        breakdown.correctiveByType.retraining += costSettings.retrainingSessionCost;
      }
      if (inc.sopId === 4 || inc.sopId === 5) {
        breakdown.correctiveActionCost += costSettings.testingCost;
        breakdown.correctiveByType.testing += costSettings.testingCost;
      }
    }
  });

  breakdown.total = breakdown.downtimeCost + breakdown.productLossCost + breakdown.correctiveActionCost;
  return breakdown;
}

// Calculate downtime cost for a single incident given costSettings
export function incidentDowntimeCost(inc, costSettings) {
  if (inc.downtimeCostOverride > 0) return inc.downtimeCostOverride;
  const rate = costSettings.downtimeHourlyRate ?? costSettings.laborHourlyRate;
  return (inc.downtimeHours || 0) * rate;
}

// Sum corrective costs for a single incident
export function incidentCorrectiveCost(inc) {
  if (!inc.correctiveCosts || inc.correctiveCosts.length === 0) return 0;
  return inc.correctiveCosts.reduce((s, c) => s + (c.cost || 0), 0);
}
