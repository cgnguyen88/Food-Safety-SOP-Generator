export const DEFAULT_COST_SETTINGS = {
  laborHourlyRate: 25,
  produceCostPerLb: 2,
  retrainingSessionCost: 500,
  testingCost: 150,
  equipmentReplacementCost: 200,
};

export const COST_FIELDS = [
  { id: "laborHourlyRate", label: "Labor Hourly Rate", prefix: "$", suffix: "/hour" },
  { id: "produceCostPerLb", label: "Average Produce Cost", prefix: "$", suffix: "/lb" },
  { id: "retrainingSessionCost", label: "Retraining Session Cost", prefix: "$", suffix: "" },
  { id: "testingCost", label: "Water/Product Testing Cost", prefix: "$", suffix: "/test" },
  { id: "equipmentReplacementCost", label: "Equipment Replacement Cost", prefix: "$", suffix: "" },
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
  const breakdown = { downtimeCost: 0, productLossCost: 0, correctiveActionCost: 0, total: 0 };

  incidents.forEach(inc => {
    if (inc.downtimeHours) {
      breakdown.downtimeCost += inc.downtimeHours * costSettings.laborHourlyRate;
    }
    const lbs = parseProductWeight(inc.affectedProduct);
    if (lbs > 0) {
      breakdown.productLossCost += lbs * costSettings.produceCostPerLb;
    }
    if (inc.severity === "high" || inc.severity === "critical") {
      breakdown.correctiveActionCost += costSettings.retrainingSessionCost;
    }
    if (inc.sopId === 4 || inc.sopId === 5) {
      breakdown.correctiveActionCost += costSettings.testingCost;
    }
  });

  breakdown.total = breakdown.downtimeCost + breakdown.productLossCost + breakdown.correctiveActionCost;
  return breakdown;
}
