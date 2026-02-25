const SOP_STANDARD_NOTES = {
  1: [
    "Focus on worker hygiene, illness reporting, toilet/handwash access, and training records.",
    "Use farm-specific procedures for who monitors, where forms are stored, and how often training happens.",
    "Keep exclusions and return-to-work criteria conservative and documented.",
  ],
  2: [
    "Focus on visitor and contractor controls: sign-in, restricted access, hygiene briefing, and supervision.",
    "Require traceable records for visitors and contractors entering production areas.",
  ],
  3: [
    "Focus on clean-then-sanitize sequencing for food-contact surfaces and tools.",
    "Use label-based sanitizer concentration/contact-time language and verification steps.",
    "Include corrective action when sanitation verification fails.",
  ],
  4: [
    "Focus on pre-harvest agricultural water risk assessment and reassessment triggers.",
    "Describe source characteristics, adjacent/upstream risks, controls, and contingency plans.",
  ],
  5: [
    "Focus on sampling protocol, chain of custody, laboratory handling, and action on exceedance.",
    "Use farm-specific logistics for sample collection, transport, and records retention.",
  ],
  6: [
    "Focus on soil amendment source, treatment verification, storage/handling, and application interval controls.",
    "Document supplier records and application logs clearly.",
  ],
  7: [
    "Focus on wildlife monitoring frequency, signs of intrusion, affected-area handling, and corrective action.",
    "Use practical scouting and documentation procedures by field/block.",
  ],
  8: [
    "Focus on pre-op checks, harvest hygiene, container/tool condition, and produce handling controls.",
    "Include hold/reject actions for contamination findings.",
  ],
  9: [
    "Focus on lot coding, traceability one step forward/one step back, contact lists, and recall execution.",
    "Use explicit decision ownership and communication flow.",
  ],
  10: [
    "Focus on incident classification, containment, root cause, corrective/preventive action, and verification.",
    "Tie corrective action records to related SOP updates and retraining.",
  ],
};

export function buildSopStandardContext(sop) {
  const requiredFields = sop.sections
    .flatMap((section) => section.fields.filter((field) => field.required).map((field) => `${field.id} (${field.label})`))
    .join(", ");

  const notes = (SOP_STANDARD_NOTES[sop.id] || []).map((line) => `- ${line}`).join("\n");

  return `SOP STANDARD CONTEXT:
SOP Title: ${sop.title}
Reference: ${sop.ref}
Scope: ${sop.desc}
Required fields in this SOP: ${requiredFields || "None"}
Compliance guardrails:
${notes || "- Stay strictly within the selected SOP scope and reference."}`;
}
