import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// CONFIGURATION — Replace with your Anthropic API key for
// standalone deployment. In Claude.ai artifacts, auth is
// handled automatically by the environment.
// ═══════════════════════════════════════════════════════════
const ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY_HERE";
const MODEL = "claude-opus-4-6";

// ═══════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --g950:#052e16;--g900:#14532d;--g800:#166534;--g700:#15803d;
    --g600:#16a34a;--g200:#bbf7d0;--g100:#dcfce7;--g50:#f0fdf4;
    --gold:#b45309;--gold-l:#fef3c7;
    --cream:#fdfcf7;--cream2:#f5f2eb;--cream3:#ede9de;
    --red:#dc2626;--red-l:#fef2f2;
    --sky:#0284c7;--sky-l:#e0f2fe;
    --txt:#1a1a18;--txt2:#4b5563;--txt3:#9ca3af;
    --bdr:#d1cfc4;--bdr2:#e8e5dc;
    --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.05);
    --shadow-md:0 4px 6px rgba(0,0,0,.06),0 2px 4px rgba(0,0,0,.04);
    --shadow-lg:0 10px 25px rgba(0,0,0,.08),0 4px 10px rgba(0,0,0,.05);
  }
  body{font-family:'IBM Plex Sans',sans-serif;background:var(--cream);color:var(--txt);line-height:1.5;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:var(--cream2);}
  ::-webkit-scrollbar-thumb{background:var(--g700);border-radius:3px;}
  input,textarea,select{font-family:'IBM Plex Sans',sans-serif;}
  @media print{
    .no-print{display:none!important;}
    .print-content{display:block!important;padding:20px;}
    body{background:white;}
  }
`;

// ═══════════════════════════════════════════════════════════
// SOP TEMPLATE DATA
// ═══════════════════════════════════════════════════════════
const SOP_DATA = [
  {
    id: 1,
    icon: "🧼",
    title: "Worker Health, Hygiene & Training",
    short: "Worker Health",
    tag: "CORE",
    ref: "FDA FSMA PSR §112 Subpart D",
    desc: "Handwashing, illness reporting, glove use, eating/drinking rules, toilet use, and worker training records.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true, ph: "Name / Title" },
        { id: "reviewed_by", label: "Reviewed By", type: "text", ph: "Name / Title" },
        { id: "review_date", label: "Next Review Date", type: "date" },
        { id: "version", label: "Version #", type: "text", ph: "1.0" },
      ]},
      { id: "handwash", title: "Handwashing Procedures", fields: [
        { id: "hw_station_locations", label: "Handwashing Station Locations", type: "textarea", required: true, ph: "List all locations (e.g., near field entrance, packing shed, restroom facilities)" },
        { id: "hw_frequency", label: "When Must Workers Wash Hands", type: "textarea", required: true, ph: "Before starting work, after using restroom, after handling waste, after breaks, after touching face..." },
        { id: "hw_supplies", label: "Supplies Provided", type: "textarea", ph: "Soap type, paper towels, hand sanitizer (where applicable)" },
        { id: "hw_monitoring", label: "Monitoring / Enforcement", type: "textarea", ph: "Who verifies handwashing compliance and how" },
      ]},
      { id: "illness", title: "Illness Reporting Policy", fields: [
        { id: "illness_symptoms", label: "Symptoms Requiring Removal from Produce Contact", type: "textarea", required: true, ph: "Diarrhea, vomiting, jaundice, sore throat with fever, exposed lesions/cuts with no waterproof cover..." },
        { id: "illness_report_to", label: "Report Illness To", type: "text", required: true, ph: "Supervisor name / role" },
        { id: "illness_return_criteria", label: "Return-to-Work Criteria", type: "textarea", ph: "Symptom-free for 48 hours, medical clearance for hepatitis A/typhoid..." },
        { id: "illness_form_location", label: "Illness Report Form Location", type: "text", ph: "File cabinet in office / posted on bulletin board" },
      ]},
      { id: "ppe", title: "Gloves & PPE Policy", fields: [
        { id: "glove_required_tasks", label: "Tasks Requiring Gloves", type: "textarea", ph: "Harvesting leafy greens, packing, handling fresh-cut produce..." },
        { id: "glove_type", label: "Glove Type / Specification", type: "text", ph: "Single-use nitrile, food-grade" },
        { id: "glove_change_freq", label: "Glove Change Frequency", type: "textarea", ph: "Every 1 hour, after contamination, after restroom use, when torn/damaged..." },
        { id: "other_ppe", label: "Other PPE Required", type: "textarea", ph: "Hair nets, beard covers, aprons, boot covers (specify by task)" },
      ]},
      { id: "conduct", title: "Eating, Drinking & Personal Conduct", fields: [
        { id: "eating_areas", label: "Designated Eating / Drinking Areas", type: "textarea", required: true, ph: "Designated break area only — NOT in field, packing shed, or near water sources" },
        { id: "tobacco_policy", label: "Tobacco / Vaping Policy", type: "text", ph: "No tobacco/vaping except in designated outdoor break area" },
        { id: "jewelry_policy", label: "Jewelry / Personal Items Policy", type: "textarea", ph: "No loose jewelry; plain wedding bands allowed; no nail polish or false nails" },
        { id: "medication_policy", label: "Medication Storage", type: "text", ph: "Personal medications stored in personal lockers or break area only" },
      ]},
      { id: "toilet", title: "Toilet & Sanitation Facilities", fields: [
        { id: "toilet_location", label: "Toilet Facility Locations", type: "textarea", required: true, ph: "Portable unit at field entrance Block A; permanent restroom in packing shed" },
        { id: "toilet_ratio", label: "Worker-to-Toilet Ratio", type: "text", ph: "1 toilet per 20 workers (minimum per OSHA)" },
        { id: "toilet_service_freq", label: "Service / Cleaning Frequency", type: "text", ph: "Daily by [contractor], inspect each morning" },
        { id: "toilet_supplies", label: "Supplies Maintained", type: "text", ph: "Soap, water, paper towels, hand sanitizer" },
      ]},
      { id: "training", title: "Training Program", fields: [
        { id: "training_schedule", label: "Training Schedule", type: "select", options: ["Upon hire only","Upon hire + annual refresher","Upon hire + semi-annual","Monthly","Seasonally (before each season)"], required: true },
        { id: "training_topics", label: "Required Training Topics", type: "textarea", required: true, ph: "Microbial contamination risks, personal hygiene, illness reporting, handwashing, FSMA PSR overview, farm-specific policies..." },
        { id: "training_provider", label: "Training Provided By", type: "text", ph: "Farm manager / PSA-trained trainer / Extension service" },
        { id: "training_record_location", label: "Training Records Stored", type: "text", ph: "Binder in farm office / shared drive folder" },
        { id: "training_language", label: "Language(s) Training Conducted In", type: "text", ph: "English, Spanish" },
      ]},
    ],
    log: { title: "Worker Training Log", cols: ["Date","Employee Name","Topic Covered","Trainer Name","Trainer Signature","Employee Signature","Notes"] },
  },
  {
    id: 2,
    icon: "🏷️",
    title: "Visitor & Contractor Policy",
    short: "Visitors",
    tag: "ACCESS",
    ref: "UC Davis Post-PSA / PSA Grower Training",
    desc: "Rules for visitors, harvest crews, maintenance contractors, and service providers including sign-in and hygiene expectations.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "review_date", label: "Next Review Date", type: "date" },
      ]},
      { id: "scope", title: "Policy Scope", fields: [
        { id: "visitor_types", label: "Types of Visitors Covered", type: "textarea", required: true, ph: "Auditors, inspectors, buyers, researchers, media, farm tours, family members, harvest contractors, pest control, repair technicians..." },
        { id: "restricted_zones", label: "Restricted Zones (Visitor Access Prohibited)", type: "textarea", ph: "Chemical storage, water pump house, area within 50 ft of water source..." },
        { id: "access_contact", label: "Visitor Coordinator / Contact Person", type: "text", ph: "Farm Manager: [Name], [Phone]" },
      ]},
      { id: "signin", title: "Sign-In Requirements", fields: [
        { id: "signin_location", label: "Sign-In Sheet Location", type: "text", required: true, ph: "Farm office entrance / gate kiosk" },
        { id: "signin_info", label: "Information Collected at Sign-In", type: "textarea", required: true, ph: "Name, company/affiliation, date/time in & out, purpose of visit, signature" },
        { id: "signin_advance_notice", label: "Advance Notice Required", type: "text", ph: "24 hours for non-emergency visits; government inspectors may arrive unannounced" },
        { id: "escort_required", label: "Escort Required in Field / Production Areas?", type: "select", options: ["Yes — always required","Yes — required for non-employees","No — after orientation briefing","No — open access with sign-in"] },
      ]},
      { id: "hygiene", title: "Hygiene Requirements for Visitors", fields: [
        { id: "hygiene_orientation", label: "Hygiene Orientation Points", type: "textarea", required: true, ph: "No eating/drinking in fields, handwash before entering production areas, report illness/symptoms, no cell phones in packing shed..." },
        { id: "ppe_for_visitors", label: "PPE Provided to Visitors", type: "textarea", ph: "Hair nets, boot covers, gloves if entering harvest area" },
        { id: "illness_exclusion", label: "Illness Exclusion Policy for Visitors", type: "textarea", ph: "Visitors showing signs of illness (vomiting, diarrhea, open wounds) will be asked to leave or postpone visit" },
        { id: "hygiene_form", label: "Visitor Hygiene Acknowledgement Form", type: "select", options: ["Yes — required before entry","Yes — available but optional","No — verbal briefing only"] },
      ]},
      { id: "contractors", title: "Contractor-Specific Requirements", fields: [
        { id: "contractor_prescreen", label: "Pre-Screening Requirements", type: "textarea", ph: "Proof of license, insurance, pesticide applicator certification (if applicable), food safety training documentation" },
        { id: "contractor_supervision", label: "Supervision During Work", type: "textarea", ph: "Farm employee must be present during all work in or near production areas" },
        { id: "contractor_records", label: "Contractor Activity Records", type: "textarea", ph: "Work order, date, work performed, materials used, contractor name — kept on file for [X] years" },
        { id: "harvest_crew_req", label: "Harvest Crew Specific Requirements", type: "textarea", ph: "PSA or equivalent training required; crew supervisor must carry training records; farm hygiene orientation required on Day 1" },
      ]},
    ],
    log: { title: "Visitor / Contractor Sign-In Log", cols: ["Date","Name","Company / Affiliation","Purpose of Visit","Time In","Time Out","Escort / Host","Hygiene Briefing Given","Signature"] },
  },
  {
    id: 3,
    icon: "🧽",
    title: "Cleaning & Sanitizing SOP",
    short: "Clean & Sanitize",
    tag: "SANITATION",
    ref: "UMD Sample SOPs / FSMA PSR §112 Subpart L",
    desc: "What gets cleaned, when, how, by whom, and sanitizer verification steps for tools, bins, and all food-contact surfaces.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "responsible_person", label: "Person Responsible for Cleaning", type: "text", required: true, ph: "Packing shed supervisor / designated worker" },
      ]},
      { id: "surfaces", title: "Food-Contact Surfaces Inventory", fields: [
        { id: "surface_list", label: "List of All Food-Contact Surfaces / Equipment", type: "textarea", required: true, ph: "Harvest bins, field crates, harvest knives/scissors, packing tables, conveyor belts, cold room shelving, scale surfaces, transport containers..." },
        { id: "non_contact_surfaces", label: "Non-Food-Contact Surfaces (also requiring cleaning)", type: "textarea", ph: "Floors, drains, walls, door handles, hand truck handles, restroom areas" },
      ]},
      { id: "procedure", title: "Cleaning & Sanitizing Procedure", fields: [
        { id: "cleaning_steps", label: "Step-by-Step Cleaning Procedure", type: "textarea", required: true, ph: "1. Remove visible debris/organic matter\n2. Rinse with potable water\n3. Apply detergent, scrub thoroughly\n4. Rinse to remove detergent residue\n5. Apply sanitizer solution\n6. Allow contact time per label\n7. Air dry (no rinsing unless food-safe sanitizer requires it)" },
        { id: "cleaning_freq", label: "Cleaning Frequency by Surface Type", type: "textarea", required: true, ph: "Harvest tools: daily / between crops\nHarvest bins: before each use\nPacking tables: before each shift\nCold room: weekly\nFloors/drains: daily" },
        { id: "pre_op_check", label: "Pre-Operation Inspection Procedure", type: "textarea", ph: "Visual inspection before each harvest/packing shift — check for cleanliness, damage, contamination signs. Document in log." },
      ]},
      { id: "sanitizer", title: "Sanitizer Information", fields: [
        { id: "sanitizer_type", label: "Sanitizer Type / Product Name", type: "text", required: true, ph: "Quaternary ammonium (e.g., Sanidate 5.0) / Chlorine (bleach solution) / Peroxyacetic acid" },
        { id: "sanitizer_concentration", label: "Use Concentration", type: "text", required: true, ph: "200 ppm quaternary ammonium; 100-200 ppm chlorine; per label" },
        { id: "contact_time", label: "Required Contact Time", type: "text", required: true, ph: "Per label — typically 30 seconds to 2 minutes" },
        { id: "test_strip_type", label: "Test Strip / Verification Method", type: "text", required: true, ph: "QAC test strips (0-500 ppm range); chlorine test strips; calibrated meter" },
        { id: "test_freq", label: "Concentration Verification Frequency", type: "text", ph: "At start of each batch prepared / every 2 hours during use" },
        { id: "sds_location", label: "Safety Data Sheet (SDS) Location", type: "text", ph: "Posted in chemical storage room / packing shed bulletin board" },
        { id: "sanitizer_storage", label: "Sanitizer Storage Location & Conditions", type: "textarea", ph: "Locked chemical storage cabinet, away from food/produce, original labeled containers" },
        { id: "corrective_action_fail", label: "Corrective Action if Concentration Fails", type: "textarea", ph: "Discard batch, prepare new solution, re-test, document in log; do not use equipment until correct concentration verified" },
      ]},
    ],
    log: { title: "Cleaning & Sanitation Log", cols: ["Date","Item / Surface Cleaned","Cleaned By","Cleaning Method","Sanitizer Product","Concentration","Test Strip Result","Pass/Fail","Corrective Action","Initials"] },
  },
  {
    id: 4,
    icon: "💧",
    title: "Preharvest Agricultural Water Assessment",
    short: "Water Assessment",
    tag: "WATER",
    ref: "FDA FSMA PSR §112 Subpart E (2024 Update)",
    desc: "Water source description, risk assessment, corrective actions, and review frequency per FDA's updated pre-harvest agricultural water rule.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "assessment_date", label: "Assessment Date", type: "date", required: true },
        { id: "assessor_name", label: "Assessor Name / Title", type: "text", required: true },
        { id: "next_review", label: "Next Review Date", type: "date" },
      ]},
      { id: "source", title: "Water Source Description", fields: [
        { id: "water_source_type", label: "Water Source Type", type: "select", options: ["Groundwater — Enclosed well","Groundwater — Open well","Surface water — Pond (on-farm)","Surface water — River/Stream","Surface water — Irrigation canal/ditch","Municipal / Public water supply","Reclaimed/recycled water","Rainwater collection","Other"], required: true },
        { id: "water_use_type", label: "Agricultural Water Use Type", type: "select", options: ["Pre-harvest irrigation (drip/subsurface — no direct contact)","Pre-harvest irrigation (overhead/furrow — potential direct contact)","Post-harvest wash/rinse (direct food contact)","Multiple uses"], required: true },
        { id: "source_description", label: "Detailed Source Description", type: "textarea", required: true, ph: "Describe: location, ownership, shared or dedicated use, infrastructure (pipes, pumps, distribution), and proximity to production areas" },
        { id: "crops_irrigated", label: "Crops / Fields Served", type: "textarea", ph: "Block A (5 acres leafy greens), Block B (3 acres tomatoes), Block C (berry rows)..." },
      ]},
      { id: "risk", title: "Risk Assessment", fields: [
        { id: "upstream_risks", label: "Upstream / Adjacent Land Use Risks", type: "textarea", required: true, ph: "Animal operations (dairy, feedlot), residential areas with septic, recreational use, flooding zones, wildlife habitat corridors, industrial runoff potential..." },
        { id: "historical_issues", label: "Historical Contamination Issues or Concerns", type: "textarea", ph: "Previous test failures, visible pollution events, flooding incidents, neighboring changes..." },
        { id: "infrastructure_risks", label: "Infrastructure / Delivery Risks", type: "textarea", ph: "Cross-connections, backflow risks, unsealed well, deteriorated pipe, distribution system shared with non-potable uses..." },
        { id: "risk_level", label: "Overall Risk Level", type: "select", options: ["Low — enclosed groundwater, low adjacent risk, consistent clean test history","Medium — some risk factors present, requires monitoring","High — surface water, adjacent animal operations, test failures, flooding risk"], required: true },
        { id: "risk_justification", label: "Risk Level Justification", type: "textarea", required: true, ph: "Explain the factors that led to this risk classification" },
      ]},
      { id: "controls", title: "Risk Management & Corrective Actions", fields: [
        { id: "current_controls", label: "Current Control Measures", type: "textarea", required: true, ph: "Drip irrigation to minimize direct contact, buffer strips maintained, well sealed and locked, filtration system in place, regular testing..." },
        { id: "corrective_actions_plan", label: "Corrective Actions if Issues Identified", type: "textarea", required: true, ph: "Stop use of water source immediately, do not harvest, investigate contamination source, test before resuming, notify farm owner/manager..." },
        { id: "contingency_source", label: "Backup / Alternative Water Source", type: "text", ph: "Municipal supply connection available for emergency use" },
      ]},
      { id: "review", title: "Assessment Review", fields: [
        { id: "review_frequency", label: "Assessment Review Frequency", type: "select", options: ["Annually","Semi-annually","After any significant event (flooding, upstream change)","Annually + after significant events"], required: true },
        { id: "trigger_events", label: "Events Triggering Immediate Reassessment", type: "textarea", ph: "Flooding, significant rainfall event, upstream spill, system damage, adjacent land use change, test failure" },
        { id: "assessor_training", label: "Assessor Training / Qualifications", type: "text", ph: "PSA Grower Training, farm operator with [X] years experience, licensed agronomist" },
      ]},
    ],
    log: { title: "Water Assessment Review Log", cols: ["Date","Assessor","Trigger for Review","Findings / Changes Noted","Risk Level Change?","Actions Taken","Signature"] },
  },
  {
    id: 5,
    icon: "🔬",
    title: "Water Testing & Sampling SOP",
    short: "Water Testing",
    tag: "WATER",
    ref: "FSMA PSR / UMD Extension Water Testing Resources",
    desc: "Sampling location, method, chain-of-custody, lab used, frequency, and records for agricultural water testing.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "testing_applicable", label: "Is Water Testing Currently Required for This Farm?", type: "select", options: ["Yes — required under PSR","Yes — required by buyer/certification","Yes — voluntary","Not currently required — surface water monitoring only","Exempt"], required: true },
      ]},
      { id: "sampling", title: "Sampling Protocol", fields: [
        { id: "sampling_locations", label: "Sampling Point Locations", type: "textarea", required: true, ph: "Well head (prior to any treatment), end of distribution line nearest to field, irrigation delivery point closest to crop canopy, post-harvest wash water input..." },
        { id: "sampling_method", label: "Sample Collection Method", type: "textarea", required: true, ph: "Use sterile 100mL Whirl-Pak bag; wear gloves; collect from flowing water; label immediately with location, date, time, sampler initials; store on ice within 30 minutes..." },
        { id: "sample_volume", label: "Sample Volume Required", type: "text", ph: "100 mL minimum for generic E. coli; confirm with lab" },
        { id: "sampling_frequency", label: "Testing Frequency", type: "select", options: ["Single annual sample (groundwater — low risk)","3 samples/year minimum","Annual geometric mean (surface water — ≥5 samples over 2-3 years)","Monthly during season","Per buyer requirement"], required: true },
        { id: "who_samples", label: "Person Responsible for Sampling", type: "text", ph: "Farm manager or designated trained employee" },
      ]},
      { id: "coc", title: "Chain of Custody & Lab", fields: [
        { id: "lab_name", label: "Testing Laboratory Name", type: "text", required: true, ph: "State Certified Environmental Lab / County Extension Lab" },
        { id: "lab_contact", label: "Lab Contact & Address", type: "textarea", ph: "Contact name, phone, email, physical address for sample drop-off" },
        { id: "lab_certification", label: "Lab Certification / Accreditation", type: "text", ph: "State-certified for drinking water analysis; NELAC/TNI accredited" },
        { id: "coc_procedure", label: "Chain-of-Custody Procedure", type: "textarea", required: true, ph: "Complete lab-provided COC form at time of collection; keep samples at ≤10°C; deliver within 6 hours of collection; obtain lab receipt confirmation..." },
        { id: "holding_time", label: "Maximum Sample Holding Time", type: "text", ph: "6 hours from collection to lab receipt (generic E. coli)" },
        { id: "parameters_tested", label: "Parameters Tested", type: "text", ph: "Generic E. coli (CFU/100 mL); Total coliform; Other pathogens if required" },
      ]},
      { id: "results", title: "Results Management", fields: [
        { id: "acceptable_limits", label: "Acceptable Limits", type: "textarea", required: true, ph: "Pre-harvest (direct contact): ≤235 CFU/100 mL generic E. coli (STV); ≤126 CFU/100 mL (GM over rolling set)\nPost-harvest: ≤100 CFU/100 mL (no detectable generic E. coli for direct food contact in some programs)" },
        { id: "action_on_exceedance", label: "Action if Results Exceed Limits", type: "textarea", required: true, ph: "1. Immediately discontinue use of affected water\n2. Do not harvest produce from affected field\n3. Investigate source of contamination\n4. Resample and retest\n5. Implement corrective actions per Water Assessment SOP\n6. Document all actions" },
        { id: "record_location", label: "Test Results Record Location", type: "text", ph: "Food safety binder, Section 5 / Digital folder: [path]" },
        { id: "retention_period", label: "Record Retention Period", type: "text", ph: "Minimum 2 years (PSR requirement); 3 years recommended" },
      ]},
    ],
    log: { title: "Water Testing & Sampling Log", cols: ["Sample Date","Sample Location","Sampled By","Sample ID","Lab Received Date","Test Parameter","Result (CFU/100mL)","Limit","Pass/Fail","Corrective Action","Notes"] },
  },
  {
    id: 6,
    icon: "🌱",
    title: "Biological Soil Amendments SOP",
    short: "Soil Amendments",
    tag: "INPUTS",
    ref: "FSMA PSR §112 Subpart F",
    desc: "How manure and compost inputs are sourced, handled, stored, and applied — with purchase and application records.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
      ]},
      { id: "types", title: "Soil Amendment Types Used", fields: [
        { id: "amendment_types_used", label: "Types of Biological Soil Amendments Used", type: "textarea", required: true, ph: "Check all that apply:\n☐ Raw / untreated animal manure\n☐ Composted animal manure (on-farm)\n☐ Purchased composted manure\n☐ Commercial biosolids\n☐ Other biological amendments (describe)" },
        { id: "amendment_sources", label: "Suppliers / Sources", type: "textarea", required: true, ph: "Name, address, and contact for each supplier; describe what records they provide (test results, treatment certificates, lot numbers)" },
      ]},
      { id: "treatment", title: "Treatment Verification", fields: [
        { id: "compost_standards", label: "Standards Used for Treated/Composted Amendments", type: "textarea", ph: "NOP composting standards (if organic): 55-77°C for 15 days with ≥5 turnings; or equivalent treatment documentation from supplier" },
        { id: "treatment_records", label: "Treatment Records Obtained from Supplier", type: "select", options: ["Yes — temperature logs and certificates provided","Yes — batch-level certificates only","No — not currently obtained","N/A — only using commercial certified compost"] },
        { id: "pathogen_testing", label: "Pathogen Testing of Amendments", type: "select", options: ["Yes — Salmonella and generic E. coli tested per NOP","Yes — tested per buyer requirement","No — relying on supplier documentation","N/A"] },
      ]},
      { id: "handling", title: "Storage & Handling", fields: [
        { id: "storage_location", label: "Storage Location", type: "text", required: true, ph: "Covered pile / enclosed shed on [location], >150 ft from water sources and production areas" },
        { id: "storage_conditions", label: "Storage Conditions & Controls", type: "textarea", ph: "Bermed to prevent runoff, covered when not in use, not stored in or adjacent to harvest areas, access restricted to prevent cross-contamination" },
        { id: "handling_procedure", label: "Handling Procedures", type: "textarea", ph: "Dedicated equipment used for amendments (not used for produce); workers wash hands after handling; equipment cleaned before re-entry to produce areas" },
      ]},
      { id: "application", title: "Application Procedures", fields: [
        { id: "application_method", label: "Application Method", type: "select", options: ["Incorporated into soil (tillage)","Surface application — no incorporation","Broadcast prior to planting","Side-dress during season","Irrigation injection (fertigation)","Other"] },
        { id: "application_timing", label: "Application Timing / Intervals", type: "textarea", required: true, ph: "Raw manure: minimum 120-day pre-harvest interval (PHI) if product contacts soil/could be splashed; 90-day PHI if no soil/splash contact. Properly composted: no mandated interval, but record application date." },
        { id: "setback_distances", label: "Setback Distances Maintained", type: "textarea", ph: ">150 ft from water sources; not applied during or within X days of rain; no application within [distance] of field boundaries / drainage ditches" },
        { id: "application_rate", label: "Application Rate", type: "text", ph: "Per soil test recommendations / agronomist guidance — document actual rate per application" },
      ]},
    ],
    log: { title: "Soil Amendment Application Log", cols: ["Date","Amendment Type","Source / Supplier","Lot #","Quantity Applied","Field / Block","Application Method","Applied By","Pre-Harvest Interval","Clearance Date","Notes"] },
  },
  {
    id: 7,
    icon: "🦌",
    title: "Animal Intrusion & Wildlife Monitoring",
    short: "Wildlife Monitoring",
    tag: "FIELD",
    ref: "FSMA PSR §112 Subpart I / UC Davis Post-PSA",
    desc: "Pre-harvest field assessment, signs of intrusion, no-harvest zones, documentation for wildlife and domestic animal management.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "assessor_name", label: "Designated Field Assessor(s)", type: "text", required: true, ph: "Name(s) and role(s) responsible for field assessments" },
      ]},
      { id: "monitoring", title: "Monitoring Program", fields: [
        { id: "monitoring_timing", label: "When Assessments Are Conducted", type: "textarea", required: true, ph: "Immediately before each harvest event; at least [X] hours before harvest begins; conducted by walking field perimeter and rows" },
        { id: "monitoring_method", label: "Assessment Method", type: "textarea", required: true, ph: "Walk perimeter, look for tracks/trails/feces/burrows/disturbed soil; check field interior systematically; note any animal sightings or evidence" },
        { id: "wildlife_types", label: "Wildlife of Concern at This Location", type: "textarea", ph: "Deer, wild pig, ground squirrels, birds, coyotes, domestic cattle/sheep from adjacent property, dogs, raccoons..." },
        { id: "seasonal_risks", label: "High-Risk Seasons / Conditions", type: "textarea", ph: "Migration season (spring/fall), drought (animals seek water/food in fields), adjacent grazing turnout periods..." },
      ]},
      { id: "intrusion_signs", title: "Intrusion Indicators", fields: [
        { id: "intrusion_signs", label: "Signs That Trigger No-Harvest Protocol", type: "textarea", required: true, ph: "Animal feces in or immediately adjacent to crop; tracks or trails through rows; carcass or remains; visible damage to crop consistent with animal grazing; urine-stained plants near evidence; active burrowing at root zone" },
        { id: "no_harvest_zone", label: "No-Harvest Zone Definition", type: "textarea", required: true, ph: "Minimum 5-foot radius around any feces; entire row if feces present and product not easily separable; field sections where distribution of contamination is unclear. FDA does not require specific buffer — use risk-based judgment." },
      ]},
      { id: "prevention", title: "Prevention Measures", fields: [
        { id: "exclusion_methods", label: "Physical Exclusion / Deterrent Methods Used", type: "textarea", ph: "Perimeter fencing (specify type/height), bird netting, exclusion wire, perimeter monitoring cameras, deterrent lights/sounds, removal of attractants (water sources, rotting produce)..." },
        { id: "buffer_management", label: "Buffer Zone / Border Area Management", type: "textarea", ph: "Vegetation management at field edges, removal of brush piles and animal habitat, coordination with neighbors regarding livestock management" },
      ]},
      { id: "response", title: "Response Procedures", fields: [
        { id: "intrusion_response", label: "Steps When Intrusion Is Found", type: "textarea", required: true, ph: "1. Mark affected area immediately (flags/cones)\n2. Define no-harvest zone\n3. Do not harvest from no-harvest zone\n4. Document findings in field assessment log\n5. Notify supervisor\n6. Continue harvest outside affected zone with vigilance\n7. Dispose of potentially contaminated produce properly\n8. Investigate entry point and implement corrective action" },
        { id: "harvest_decision", label: "Harvest Decision Authority", type: "text", ph: "Farm manager or designated supervisor makes final harvest/no-harvest determination" },
        { id: "disposal_procedure", label: "Cull / Contaminated Produce Disposal", type: "textarea", ph: "Do not donate, feed to animals, or sell; document quantity disposed; dispose in sealed bag/trash or bury away from production area" },
      ]},
    ],
    log: { title: "Pre-Harvest Field Assessment Log", cols: ["Date","Field / Block","Crop","Assessor Name","Time of Assessment","Evidence Found? (Y/N)","Description of Finding","No-Harvest Zone Established?","Zone Description","Harvest Proceeded? (Y/N)","Supervisor Sign-off"] },
  },
  {
    id: 8,
    icon: "🌾",
    title: "Harvest & Postharvest Handling SOP",
    short: "Harvest & Handling",
    tag: "HARVEST",
    ref: "FSMA PSR §112 Subparts K & L",
    desc: "Harvest tool and bin condition, handling practices, cull management, contamination response, and daily pre-op checks.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "harvest_supervisor", label: "Harvest Supervisor / Responsible Person", type: "text", required: true },
      ]},
      { id: "preop", title: "Daily Pre-Operation Inspection", fields: [
        { id: "preop_timing", label: "When Pre-Op Inspection Occurs", type: "text", required: true, ph: "Before each harvest shift begins; minimum 30 minutes prior to harvest start" },
        { id: "preop_checklist", label: "Pre-Op Inspection Items", type: "textarea", required: true, ph: "☐ Harvest bins/containers: clean, sanitized, no cracks/damage, no standing water\n☐ Harvest tools (knives, shears, clippers): clean, sanitized, no rust or damage\n☐ Worker hygiene: hands washed, appropriate clothing/PPE\n☐ Field conditions: no flooding, standing water, sewage overflow, or unusual contamination\n☐ Animal intrusion assessment completed (see SOP #7)\n☐ Water source for wash/cool: tested, acceptable, no visible contamination\n☐ Transport containers/vehicles: clean, no co-mingling risk" },
        { id: "preop_authority", label: "Who Conducts Pre-Op Inspection", type: "text", ph: "Harvest supervisor / designated lead worker" },
        { id: "preop_fail_action", label: "Action if Pre-Op Fails", type: "textarea", ph: "Do not begin harvest; correct issue; re-inspect; document in pre-op log; notify farm manager if issue cannot be resolved before harvest window" },
      ]},
      { id: "tools_containers", title: "Tools & Container Management", fields: [
        { id: "tool_inspection_criteria", label: "Tool Acceptance / Rejection Criteria", type: "textarea", required: true, ph: "Reject tools that are: rusty, cracked/broken, cannot be sanitized effectively, contaminated with unknown substances, contaminated with animal feces or blood. Clean and sanitize all acceptable tools per C&S SOP." },
        { id: "container_criteria", label: "Container / Bin Acceptance Criteria", type: "textarea", required: true, ph: "Containers must be: food-grade or designated food-use only, free of cracks/chips/sharp edges that harbor bacteria, clean and sanitized, not previously used for non-food items, free of standing water and debris" },
        { id: "damaged_container_action", label: "Action for Damaged / Contaminated Containers", type: "textarea", ph: "Remove from service immediately; tag with 'Do Not Use'; quarantine until repaired/replaced or properly disposed" },
        { id: "dedicated_equipment", label: "Food vs. Non-Food Equipment Designation", type: "textarea", ph: "Color-coded: red handles = non-food use only; green handles = produce use only; all produce-contact equipment stored separately from non-food equipment" },
      ]},
      { id: "handling", title: "Handling Practices", fields: [
        { id: "hygiene_during_harvest", label: "Worker Hygiene During Harvest", type: "textarea", required: true, ph: "Wash hands before harvest and after any break, restroom use, or contamination event; no eating/drinking in field; handle produce gently to minimize damage; do not place produce directly on ground" },
        { id: "produce_protection", label: "Produce Protection Measures", type: "textarea", ph: "Keep bins shaded and covered when not actively loading; minimize time from field to cooler; do not overfill containers; do not place produce near animal waste, chemicals, or non-food materials" },
        { id: "temperature_control", label: "Temperature Control Requirements", type: "textarea", ph: "Field heat removal target: reach [X]°F within [X] hours of harvest; transport temperature: maintain ≤[X]°F; document temperature of cooler/reefer at time of loading" },
        { id: "postharvest_water", label: "Postharvest Wash / Cooling Water", type: "textarea", ph: "Use potable water only; maintain chlorine level [X] ppm; pH [X-X]; temperature differential ≤10°F cooler than produce (hydrocooling); change water when visibly dirty or per schedule; test per Water Testing SOP" },
      ]},
      { id: "culls", title: "Cull Management & Contamination Response", fields: [
        { id: "cull_procedure", label: "Cull Management Procedure", type: "textarea", required: true, ph: "Remove damaged/diseased/contaminated produce immediately; place in clearly marked cull bins; do not allow culls to re-enter harvest stream; dispose of culls daily; document significant cull volumes" },
        { id: "contamination_response", label: "Contamination Event Response Protocol", type: "textarea", required: true, ph: "Scenarios: broken glass, sewage overflow, chemical spill, cross-contamination\n1. Stop harvest immediately\n2. Segregate and hold all potentially affected produce\n3. Notify supervisor and farm manager\n4. Document incident\n5. Follow Corrective Action SOP #10 for disposition decision\n6. Do not release affected product until decision made" },
        { id: "foreign_material", label: "Foreign Material Control", type: "textarea", ph: "Conduct pre-harvest field sweep for glass, metal, plastic; report and document any findings; do not harvest within [X] ft of broken glass or sharp debris until cleared" },
      ]},
    ],
    log: { title: "Daily Pre-Op Inspection Log", cols: ["Date","Shift / Crop","Inspector Name","Bins/Containers (Pass/Fail)","Tools (Pass/Fail)","Worker Hygiene (Pass/Fail)","Field Conditions (Pass/Fail)","Water (Pass/Fail)","Overall Result","Issues Noted","Corrective Actions","Sign-off"] },
  },
  {
    id: 9,
    icon: "📋",
    title: "Traceability & Lot Coding / Recall Readiness",
    short: "Traceability",
    tag: "RECORDS",
    ref: "Cornell PSA / FSMA Requirements + Buyer Reqs",
    desc: "Lot coding method, shipment and customer records, and mock recall process for audit and incident readiness.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "recall_coordinator", label: "Recall Coordinator (Primary Contact)", type: "text", required: true, ph: "Name, title, phone, email" },
        { id: "recall_backup", label: "Backup Recall Coordinator", type: "text", ph: "Name, title, phone, email" },
      ]},
      { id: "lot_coding", title: "Lot Coding System", fields: [
        { id: "lot_code_method", label: "Lot Code System Description", type: "textarea", required: true, ph: "Describe your system: Julian date + farm ID + field block (e.g., GVF-A-2025-183 = Green Valley Farm, Block A, day 183 of 2025). Or: harvest date YYYYMMDD + crop code." },
        { id: "lot_code_format", label: "Lot Code Format Example", type: "text", required: true, ph: "GVF-LETTUCE-20250703-A1 (FarmCode-Crop-HarvestDate-FieldBlock)" },
        { id: "lot_code_placement", label: "Where Lot Code Appears on Product", type: "textarea", ph: "Printed on case/bag label; handwritten on field tag attached to bin; stamped on carton lid; in packing records" },
        { id: "smallest_traceable_unit", label: "Smallest Traceable Unit", type: "text", ph: "Individual case / pallet / bin — specify what a single lot code represents" },
        { id: "lot_code_records_kept", label: "Records Linking Lot Code to Source", type: "textarea", required: true, ph: "Each lot code traceable to: harvest date, field/block, crop, harvest crew, batch of seeds/transplants, water source used, inputs applied, harvest supervisor" },
      ]},
      { id: "shipping", title: "Shipment & Customer Records", fields: [
        { id: "customer_record_content", label: "Information Captured in Shipment Records", type: "textarea", required: true, ph: "Customer name, address, phone; delivery date; lot code(s) shipped; product description; quantity/weight; invoice or PO number; delivery driver/transporter" },
        { id: "record_system", label: "Record-Keeping System Used", type: "text", ph: "Paper log books + scanned copies; QuickBooks; spreadsheet in Google Sheets; farm management software (name)" },
        { id: "record_retention", label: "Record Retention Period", type: "text", required: true, ph: "Minimum 2 years per FSMA PSR; 3 years recommended; permanent for any recall events" },
        { id: "record_location", label: "Records Location / Access", type: "text", ph: "Farm office filing cabinet + digital backup in [cloud folder]; authorized access: owner, manager, food safety coordinator" },
      ]},
      { id: "recall", title: "Mock Recall & Recall Response", fields: [
        { id: "mock_recall_frequency", label: "Mock Recall Frequency", type: "select", options: ["Annually","Semi-annually","Quarterly","Not yet established"], required: true },
        { id: "last_mock_recall", label: "Date of Last Mock Recall Exercise", type: "date" },
        { id: "recall_trigger", label: "Events That Trigger a Real Recall", type: "textarea", required: true, ph: "Customer complaint of illness, positive pathogen test result on product, regulatory notification, confirmed contamination event during production, recall of common ingredient/input" },
        { id: "recall_steps", label: "Recall Initiation Steps", type: "textarea", required: true, ph: "1. Notify Recall Coordinator immediately\n2. Identify all affected lot codes\n3. Contact all customers who received affected product\n4. Place hold on any remaining inventory\n5. Notify FDA (if required — for covered produce under FSMA)\n6. Document all actions and communications\n7. Conduct root cause analysis\n8. Issue public notification if directed by FDA" },
        { id: "recall_24hr_goal", label: "Trace-Back / Trace-Forward Time Goal", type: "text", ph: "Able to identify all recipients of any lot within 2 hours; mock recall target: <1 hour" },
        { id: "regulatory_contacts", label: "Regulatory Contacts", type: "textarea", ph: "FDA District Office: [number]; State Dept of Agriculture: [number]; FSMA Rapid Response: 1-866-300-4374" },
      ]},
    ],
    log: { title: "Shipment / Traceability Log", cols: ["Harvest Date","Lot Code","Crop / Product","Quantity / Weight","Pack Date","Customer Name","Customer Address","Delivery Date","Invoice #","Received By","Notes"] },
  },
  {
    id: 10,
    icon: "⚠️",
    title: "Corrective Action & Incident Response",
    short: "Corrective Action",
    tag: "RESPONSE",
    ref: "FSMA PSR / FDA Incident Response / Cornell PSA",
    desc: "What to do when contamination is suspected — broken glass, sewage overflow, sick worker, sanitizer failure, or water concern. Includes log and disposition decisions.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "primary_contact", label: "Primary Decision-Maker for Incidents", type: "text", required: true, ph: "Owner / Farm Manager: Name, cell phone" },
      ]},
      { id: "scenarios", title: "Covered Incident Scenarios", fields: [
        { id: "contamination_scenarios", label: "Types of Incidents This SOP Covers", type: "textarea", required: true, ph: "☐ Biological: sick worker handling produce, animal intrusion/feces, sewage overflow, flooding\n☐ Physical: broken glass/wood/metal in production area, foreign object in product\n☐ Chemical: pesticide misapplication, sanitizer failure or overdose, fuel spill\n☐ Microbiological: positive water or product test, multiple consumer illness reports\n☐ Facility: power failure affecting cold storage, pest infestation, equipment failure" },
      ]},
      { id: "immediate", title: "Immediate Response Protocol", fields: [
        { id: "stop_work_criteria", label: "Stop Work / Stop Harvest Criteria", type: "textarea", required: true, ph: "Any confirmed or suspected contamination of produce contact surfaces or product; positive pathogen test; sewage or chemical spill in or adjacent to production area; sick worker who has been handling product; broken glass or metal found in harvest area" },
        { id: "immediate_steps", label: "Immediate Response Steps (First 30 Minutes)", type: "textarea", required: true, ph: "1. STOP work in affected area immediately\n2. Segregate and hold all potentially affected product (do not release)\n3. Isolate the incident area with physical barrier\n4. Notify primary decision-maker\n5. Ensure worker safety (remove from area if health risk)\n6. Document time, location, and nature of incident\n7. Preserve evidence (do not clean up contamination until documented)\n8. Begin incident log entry" },
        { id: "notification_contacts", label: "Notification Chain", type: "textarea", required: true, ph: "Internal: Farm owner → Farm manager → Food safety coordinator\nExternal (if required): FDA 24-hr line, State Dept of Ag, customers with affected product, recall coordinator per Traceability SOP" },
      ]},
      { id: "investigation", title: "Investigation & Root Cause", fields: [
        { id: "investigation_steps", label: "Investigation Procedure", type: "textarea", required: true, ph: "1. Identify scope of affected product (use lot codes)\n2. Identify time period of potential exposure\n3. Trace back through production records to find root cause\n4. Interview workers present\n5. Review monitoring logs (water, cleaning, animal assessment)\n6. Document findings\n7. Consult with extension, FDA, or food safety advisor as needed" },
        { id: "root_cause_analysis", label: "Root Cause Analysis Method", type: "textarea", ph: "5-Why analysis; Fishbone/Ishikawa diagram; Timeline reconstruction — document which method used for each incident" },
      ]},
      { id: "disposition", title: "Product Disposition", fields: [
        { id: "hold_procedure", label: "Product Hold Procedure", type: "textarea", required: true, ph: "Tag all affected product with 'HOLD — Do Not Ship' label; isolate in designated hold area; log lot codes, quantities, and hold date; maintain temperature if applicable; do not release until disposition decision made" },
        { id: "disposition_options", label: "Disposition Decision Options", type: "textarea", required: true, ph: "1. RELEASE: Investigation confirms product is safe, no contamination risk — document justification\n2. DIVERT: Product acceptable for non-food use (animal feed, compost) if safe to do so\n3. DESTROY: Product confirmed contaminated or risk cannot be ruled out — document destruction (quantity, method, witness)\n4. RECALL: Product already shipped — activate Recall SOP #9 immediately" },
        { id: "release_authority", label: "Who Has Authority to Release Held Product", type: "text", ph: "Farm owner or designated food safety manager ONLY — no product released without documented approval" },
      ]},
      { id: "prevention", title: "Corrective Action & Prevention", fields: [
        { id: "corrective_action_process", label: "Corrective Action Development Process", type: "textarea", required: true, ph: "After root cause identified: develop specific corrective action to address root cause; assign responsible person and deadline; implement and document; verify effectiveness at follow-up inspection; update relevant SOP if procedure change needed" },
        { id: "return_to_operation", label: "Return-to-Operation Criteria", type: "textarea", required: true, ph: "Document that: root cause addressed, corrective action implemented, area cleaned and sanitized (verified), equipment repaired/replaced, staff retrained if applicable, supervisor review completed. Sign-off required before resuming operations." },
        { id: "fsma_notification", label: "FSMA / Regulatory Notification Requirements", type: "textarea", ph: "FDA requires notification for certain recall events involving covered produce under PSR. Contact FDA Emergency Line: 1-866-300-4374 (24/7). Consult state Dept of Ag for state-level requirements." },
      ]},
    ],
    log: { title: "Corrective Action & Incident Log", cols: ["Incident Date","Discovered By","Time Discovered","Incident Type","Description","Immediate Action Taken","Product Affected (Lot #s)","Quantity on Hold","Root Cause","Corrective Action","Product Disposition","Resolved Date","Decision Made By","Sign-off"] },
  },
];

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════
async function callClaude(messages, systemPrompt) {
  const headers = { "Content-Type": "application/json" };
  if (ANTHROPIC_API_KEY !== "YOUR_ANTHROPIC_API_KEY_HERE") {
    headers["x-api-key"] = ANTHROPIC_API_KEY;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: systemPrompt, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(b => b.text || "").join("") || "";
}

function parseFormUpdates(text) {
  const match = text.match(/<form_update>([\s\S]*?)<\/form_update>/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

function stripFormUpdate(text) {
  return text.replace(/<form_update>[\s\S]*?<\/form_update>/g, "").trim();
}

function generateShareLink(sopId, formData) {
  const payload = { sopId, formData };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `${window.location.href.split("#")[0]}#share=${encoded}`;
}

function decodeShareLink() {
  const hash = window.location.hash;
  if (!hash.startsWith("#share=")) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(hash.slice(7))));
    return JSON.parse(decoded);
  } catch { return null; }
}

function downloadAsDocx(sop, formData, farmProfile) {
  const getVal = (id) => formData[id] || "";
  let html = `<html><head><meta charset="utf-8"><style>
    body{font-family:Calibri,sans-serif;font-size:11pt;margin:1in;}
    h1{font-size:16pt;color:#14532d;border-bottom:2px solid #14532d;padding-bottom:6pt;}
    h2{font-size:13pt;color:#166534;margin-top:18pt;}
    h3{font-size:11pt;color:#374151;margin-top:12pt;}
    .field{margin-bottom:10pt;} .label{font-weight:bold;color:#374151;}
    .value{border-bottom:1px solid #ccc;min-width:200pt;display:inline-block;min-height:14pt;}
    table{width:100%;border-collapse:collapse;margin-top:10pt;font-size:9pt;}
    th{background:#14532d;color:white;padding:6pt;text-align:left;}
    td{border:1px solid #ccc;padding:5pt;}tr:nth-child(even){background:#f0fdf4;}
    .header-block{background:#f0fdf4;padding:12pt;border:1px solid #bbf7d0;margin-bottom:18pt;}
  </style></head><body>`;
  html += `<div class="header-block">`;
  if (farmProfile?.farm_name) html += `<h1>🌱 ${farmProfile.farm_name}</h1>`;
  html += `<h1>${sop.title}</h1>`;
  html += `<p><strong>Reference:</strong> ${sop.ref}</p>`;
  if (farmProfile) {
    html += `<p><strong>Farm:</strong> ${farmProfile.farm_name || ""} | <strong>Address:</strong> ${farmProfile.address || ""}</p>`;
    html += `<p><strong>Operation Type:</strong> ${farmProfile.operation_type || ""} | <strong>Certifier:</strong> ${farmProfile.certifier || ""}</p>`;
  }
  html += `</div>`;
  for (const section of sop.sections) {
    html += `<h2>${section.title}</h2>`;
    for (const field of section.fields) {
      const val = getVal(field.id);
      html += `<div class="field"><span class="label">${field.label}: </span>`;
      html += val ? `<span>${val.replace(/\n/g, "<br/>")}</span>` : `<span class="value">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`;
      html += `</div>`;
    }
  }
  html += `<h2>📋 ${sop.log.title}</h2>`;
  html += `<table><tr>${sop.log.cols.map(c => `<th>${c}</th>`).join("")}</tr>`;
  for (let i = 0; i < 10; i++) html += `<tr>${sop.log.cols.map(() => `<td>&nbsp;</td>`).join("")}</tr>`;
  html += `</table>`;
  html += `<br/><p style="font-size:9pt;color:#9ca3af;">Generated by Farm Food Safety SOP System | ${new Date().toLocaleDateString()} | FSMA Produce Safety Rule compliant template</p>`;
  html += `</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_SOP.doc`;
  a.click(); URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
// TAG COLORS
// ═══════════════════════════════════════════════════════════
const TAG_COLORS = {
  CORE: "#166534", WATER: "#0284c7", SANITATION: "#7c3aed", ACCESS: "#b45309",
  INPUTS: "#15803d", FIELD: "#b45309", HARVEST: "#166534", RECORDS: "#374151", RESPONSE: "#dc2626",
};

// ═══════════════════════════════════════════════════════════
// COMPONENT: FarmProfileModal
// ═══════════════════════════════════════════════════════════
function FarmProfileModal({ profile, onSave, onClose }) {
  const [form, setForm] = useState(profile || {});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const fields = [
    { id: "farm_name", label: "Farm / Operation Name", ph: "Green Valley Farm" },
    { id: "owner_name", label: "Owner / Operator Name", ph: "Jane Smith" },
    { id: "address", label: "Farm Address", ph: "1234 Farm Road, City, State, ZIP" },
    { id: "phone", label: "Phone", ph: "(555) 123-4567" },
    { id: "email", label: "Email", ph: "owner@greenvallyfarm.com" },
    { id: "operation_type", label: "Operation Type", ph: "Mixed vegetable, ~15 acres, seasonal harvest crew" },
    { id: "crops", label: "Primary Crops Grown", ph: "Leafy greens, tomatoes, cucumbers, herbs" },
    { id: "certifier", label: "Certifier / Auditor", ph: "Oregon Tilth / PrimusGFS / Self-audit" },
    { id: "fsma_status", label: "FSMA Coverage Status", ph: "Covered farm (>$25K avg annual sales)" },
    { id: "notes", label: "Additional Notes", ph: "Any relevant context for AI-assisted form completion" },
  ];
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--cream)",borderRadius:16,width:"min(600px,95vw)",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"var(--shadow-lg)" }}>
        <div style={{ padding:"28px 32px 20px",borderBottom:"1px solid var(--bdr2)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <h2 style={{ fontFamily:"Lora,serif",fontSize:22,color:"var(--g900)" }}>🌱 My Farm Profile</h2>
              <p style={{ fontSize:13,color:"var(--txt2)",marginTop:4 }}>Saved locally — auto-fills all SOP templates</p>
            </div>
            <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--txt3)",lineHeight:1 }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY:"auto",padding:"24px 32px" }}>
          {fields.map(f => (
            <div key={f.id} style={{ marginBottom:16 }}>
              <label style={{ display:"block",fontSize:13,fontWeight:600,color:"var(--txt2)",marginBottom:6 }}>{f.label}</label>
              {f.id === "notes" || f.id === "crops" || f.id === "operation_type" ? (
                <textarea value={form[f.id]||""} onChange={e=>set(f.id,e.target.value)} placeholder={f.ph}
                  style={{ width:"100%",padding:"8px 12px",border:"1.5px solid var(--bdr)",borderRadius:8,fontSize:13,resize:"vertical",minHeight:64,background:"white",outline:"none" }} />
              ) : (
                <input type="text" value={form[f.id]||""} onChange={e=>set(f.id,e.target.value)} placeholder={f.ph}
                  style={{ width:"100%",padding:"8px 12px",border:"1.5px solid var(--bdr)",borderRadius:8,fontSize:13,background:"white",outline:"none" }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ padding:"20px 32px",borderTop:"1px solid var(--bdr2)",display:"flex",gap:12,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"9px 20px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"white",cursor:"pointer",fontSize:13,fontWeight:500 }}>Cancel</button>
          <button onClick={()=>onSave(form)} style={{ padding:"9px 24px",background:"var(--g800)",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>Save Profile</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: ExportModal
// ═══════════════════════════════════════════════════════════
function ExportModal({ sop, formData, farmProfile, onClose }) {
  const [copied, setCopied] = useState(false);
  const shareLink = generateShareLink(sop.id, formData);

  const handlePrint = () => { window.print(); };
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--cream)",borderRadius:16,width:"min(480px,95vw)",boxShadow:"var(--shadow-lg)" }}>
        <div style={{ padding:"28px 32px 20px",borderBottom:"1px solid var(--bdr2)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <h2 style={{ fontFamily:"Lora,serif",fontSize:20,color:"var(--g900)" }}>Export & Share</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--txt3)" }}>✕</button>
        </div>
        <div style={{ padding:"24px 32px",display:"flex",flexDirection:"column",gap:12 }}>
          {[
            { icon:"🖨️", label:"View & Print / Save as PDF", desc:"Opens browser print dialog — choose 'Save as PDF'", action: handlePrint, color:"var(--g800)" },
            { icon:"📄", label:"Download as Word (.doc)", desc:"Opens in Microsoft Word or Google Docs", action:()=>{downloadAsDocx(sop,formData,farmProfile);onClose();}, color:"var(--sky)" },
            { icon:"🔗", label:copied?"✅ Link Copied!":"Copy Share Link", desc:"Anyone with this link can view your filled template", action: handleCopyLink, color: copied ? "var(--g700)" : "var(--gold)" },
          ].map((btn,i) => (
            <button key={i} onClick={btn.action} style={{ display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:"white",border:"1.5px solid var(--bdr)",borderRadius:12,cursor:"pointer",textAlign:"left",transition:"border-color .15s" }}>
              <span style={{ fontSize:28 }}>{btn.icon}</span>
              <div>
                <div style={{ fontWeight:600,fontSize:14,color:btn.color }}>{btn.label}</div>
                <div style={{ fontSize:12,color:"var(--txt3)",marginTop:2 }}>{btn.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding:"12px 32px 24px" }}>
          <button onClick={onClose} style={{ width:"100%",padding:"10px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt2)" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: FormPanel
// ═══════════════════════════════════════════════════════════
function FormPanel({ sop, formData, onChange, missingFields }) {
  const [openSection, setOpenSection] = useState(sop.sections[0]?.id);
  const inputStyle = (id) => ({
    width:"100%", padding:"8px 12px", border:`1.5px solid ${missingFields?.includes(id)?"var(--red)":"var(--bdr)"}`,
    borderRadius:8, fontSize:13, background:"white", outline:"none", resize:"vertical",
    fontFamily:"'IBM Plex Sans',sans-serif", transition:"border-color .15s",
  });

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
      {sop.sections.map(section => (
        <div key={section.id} style={{ marginBottom:12,border:"1.5px solid var(--bdr2)",borderRadius:12,overflow:"hidden",background:"white" }}>
          <button onClick={()=>setOpenSection(openSection===section.id?null:section.id)}
            style={{ width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:openSection===section.id?"var(--g50)":"white",border:"none",cursor:"pointer",textAlign:"left" }}>
            <span style={{ fontWeight:600,fontSize:14,color:openSection===section.id?"var(--g800)":"var(--txt)" }}>{section.title}</span>
            <span style={{ fontSize:18,color:"var(--g700)",transform:openSection===section.id?"rotate(180deg)":"",transition:"transform .2s" }}>⌄</span>
          </button>
          {openSection === section.id && (
            <div style={{ padding:"16px 18px 20px",borderTop:"1px solid var(--bdr2)" }}>
              {section.fields.map(field => (
                <div key={field.id} style={{ marginBottom:14 }}>
                  <label style={{ display:"flex",alignItems:"center",gap:4,fontSize:13,fontWeight:500,color:"var(--txt2)",marginBottom:5 }}>
                    {field.label}
                    {field.required && <span style={{ color:"var(--red)",fontSize:11 }}>*</span>}
                    {missingFields?.includes(field.id) && <span style={{ fontSize:11,color:"var(--red)",marginLeft:4 }}>⚠ Required</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea value={formData[field.id]||""} onChange={e=>onChange(field.id,e.target.value)}
                      placeholder={field.ph||""} rows={3} style={inputStyle(field.id)} />
                  ) : field.type === "select" ? (
                    <select value={formData[field.id]||""} onChange={e=>onChange(field.id,e.target.value)} style={{...inputStyle(field.id),height:38}}>
                      <option value="">— Select —</option>
                      {field.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.type||"text"} value={formData[field.id]||""} onChange={e=>onChange(field.id,e.target.value)}
                      placeholder={field.ph||""} style={{...inputStyle(field.id),height:38}} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop:16,padding:"16px 18px",border:"1.5px solid var(--bdr2)",borderRadius:12,background:"var(--g50)" }}>
        <div style={{ fontWeight:600,fontSize:13,color:"var(--g800)",marginBottom:8 }}>📋 {sop.log.title}</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
            <thead>
              <tr>{sop.log.cols.map(c=><th key={c} style={{ background:"var(--g800)",color:"white",padding:"7px 8px",textAlign:"left",whiteSpace:"nowrap",fontWeight:500 }}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {[0,1,2].map(i=><tr key={i}>{sop.log.cols.map((c,j)=><td key={j} style={{ border:"1px solid var(--bdr2)",padding:"8px",background:i%2===0?"white":"var(--cream)" }}>&nbsp;</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize:11,color:"var(--txt3)",marginTop:8 }}>Log template — additional rows appear in exported document</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: ChatPanel
// ═══════════════════════════════════════════════════════════
function ChatPanel({ sop, formData, onFormUpdate, farmProfile }) {
  const [messages, setMessages] = useState([
    { role:"assistant", content:`Hello! I'm your food safety compliance assistant. I'm here to help you complete the **${sop.title}** SOP.\n\nI can:\n• **Fill in fields** based on your farm description\n• **Explain regulations** behind each requirement\n• **Review your form** for compliance gaps\n• **Provide examples** for any field\n\nHow would you like to start? Describe your farm and operation, or ask me about any specific field.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const buildSystemPrompt = () => {
    const filledFields = Object.entries(formData).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join("\n");
    const allFields = sop.sections.flatMap(s=>s.fields).map(f=>`${f.id} (${f.label}${f.required?" — REQUIRED":""})`).join(", ");
    return `You are an expert FSMA Produce Safety Rule (PSR) food safety compliance assistant helping a farm operator complete their "${sop.title}" SOP.
Reference: ${sop.ref}

${farmProfile ? `FARM PROFILE:\nFarm: ${farmProfile.farm_name||""}\nOwner: ${farmProfile.owner_name||""}\nAddress: ${farmProfile.address||""}\nOperation: ${farmProfile.operation_type||""}\nCrops: ${farmProfile.crops||""}\nFSMA Status: ${farmProfile.fsma_status||""}` : "No farm profile saved yet."}

SOP PURPOSE: ${sop.desc}

CURRENT FORM VALUES (already filled):
${filledFields || "No fields filled yet"}

ALL FORM FIELDS AVAILABLE TO FILL:
${allFields}

INSTRUCTIONS:
1. Be conversational, specific, and helpful. Answer questions about food safety regulations accurately.
2. When you have enough info to fill one or more fields, include a form_update block:
<form_update>
{"field_id": "value to populate", "another_field": "its value"}
</form_update>
Use the exact field IDs listed above. Values should be complete, regulatory-compliant text.
3. For textarea fields, use \\n for line breaks.
4. When reviewing the form, check all required fields and flag specific compliance gaps.
5. Reference FDA FSMA PSR, Cornell PSA, UC Davis Post-PSA, and UMD Extension guidance where relevant.
6. Keep responses concise — 2-4 paragraphs max unless explaining regulations in detail.`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role:"user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await callClaude(apiMessages, buildSystemPrompt());
      const formUpdate = parseFormUpdates(response);
      const cleanResponse = stripFormUpdate(response);
      if (formUpdate) onFormUpdate(formUpdate);
      setMessages(prev => [...prev, { role:"assistant", content: cleanResponse + (formUpdate ? "\n\n✅ *I've updated the relevant fields in the form.*" : "") }]);
    } catch (e) {
      setMessages(prev => [...prev, { role:"assistant", content:`⚠️ Connection error: ${e.message}\n\nPlease check your API key configuration.` }]);
    }
    setLoading(false);
  };

  const quickActions = [
    { label:"📝 Describe my farm", text:"Let me describe my farm operation so you can help fill in this SOP." },
    { label:"🔍 Review my form", text:"Please review my current form for any missing required fields or compliance gaps." },
    { label:"📚 Explain this SOP", text:"Can you explain the regulatory requirements behind this SOP and what FSMA expects?" },
    { label:"💡 Give me examples", text:"Can you give me example responses for the main fields in this SOP?" },
  ];

  const renderMarkdown = (text) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  return (
    <div style={{ width:380,minWidth:340,display:"flex",flexDirection:"column",borderRight:"1.5px solid var(--bdr2)",background:"white" }}>
      <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--bdr2)",background:"var(--g50)" }}>
        <div style={{ fontSize:13,fontWeight:600,color:"var(--g800)" }}>🤖 AI Food Safety Assistant</div>
        <div style={{ fontSize:11,color:"var(--txt3)",marginTop:2 }}>Powered by Claude • FSMA PSR Expert</div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12 }}>
        {messages.map((msg,i) => (
          <div key={i} style={{ display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start" }}>
            <div style={{
              maxWidth:"88%", padding:"10px 14px", borderRadius: msg.role==="user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: msg.role==="user" ? "var(--g800)" : "var(--cream2)",
              color: msg.role==="user" ? "white" : "var(--txt)", fontSize:13, lineHeight:1.6,
            }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex",gap:4,padding:"10px 14px",background:"var(--cream2)",borderRadius:"14px 14px 14px 4px",width:"fit-content" }}>
            {[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"var(--g600)",animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:"12px 16px",borderTop:"1px solid var(--bdr2)",display:"flex",flexWrap:"wrap",gap:6 }}>
        {quickActions.map(a=>(
          <button key={a.label} onClick={()=>sendMessage(a.text)}
            style={{ fontSize:11,padding:"5px 10px",border:"1px solid var(--bdr)",borderRadius:20,background:"var(--cream)",cursor:"pointer",color:"var(--txt2)",whiteSpace:"nowrap" }}>
            {a.label}
          </button>
        ))}
      </div>
      <div style={{ padding:"12px 16px",borderTop:"1px solid var(--bdr2)",display:"flex",gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage(input)}
          placeholder="Ask about this SOP or describe your farm..."
          style={{ flex:1,padding:"10px 14px",border:"1.5px solid var(--bdr)",borderRadius:24,fontSize:13,outline:"none",background:"var(--cream)" }} />
        <button onClick={()=>sendMessage(input)} disabled={loading||!input.trim()}
          style={{ width:42,height:42,borderRadius:"50%",background:loading||!input.trim()?"var(--g200)":"var(--g800)",border:"none",cursor:loading||!input.trim()?"not-allowed":"pointer",fontSize:18,color:"white",display:"flex",alignItems:"center",justifyContent:"center" }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: SOPEditor
// ═══════════════════════════════════════════════════════════
function SOPEditor({ sop, farmProfile, onBack }) {
  const [formData, setFormData] = useState(() => {
    // Pre-fill from farm profile
    const init = {};
    if (farmProfile?.farm_name) init.farm_name = farmProfile.farm_name;
    if (farmProfile?.owner_name) init.prepared_by = farmProfile.owner_name;
    return init;
  });
  const [missingFields, setMissingFields] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const handleChange = (id, val) => {
    setFormData(p => ({ ...p, [id]: val }));
    setMissingFields(prev => prev.filter(f => f !== id));
  };
  const handleFormUpdate = (updates) => setFormData(p => ({ ...p, ...updates }));

  const handleReview = () => {
    const required = sop.sections.flatMap(s => s.fields.filter(f => f.required).map(f => f.id));
    const missing = required.filter(id => !formData[id]);
    setMissingFields(missing);
    setReviewMode(true);
    return missing;
  };

  const completionPct = () => {
    const all = sop.sections.flatMap(s => s.fields);
    const filled = all.filter(f => formData[f.id]);
    return Math.round((filled.length / all.length) * 100);
  };
  const pct = completionPct();

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ padding:"14px 24px",borderBottom:"1.5px solid var(--bdr2)",display:"flex",alignItems:"center",gap:16,background:"white",flexShrink:0 }} className="no-print">
        <button onClick={onBack} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",border:"1.5px solid var(--bdr)",borderRadius:8,background:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt2)" }}>
          ← Back
        </button>
        <span style={{ fontSize:20 }}>{sop.icon}</span>
        <div style={{ flex:1 }}>
          <h2 style={{ fontFamily:"Lora,serif",fontSize:17,color:"var(--g900)",lineHeight:1.2 }}>{sop.title}</h2>
          <p style={{ fontSize:11,color:"var(--txt3)",marginTop:2 }}>{sop.ref}</p>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11,color:"var(--txt3)" }}>Completion</div>
            <div style={{ fontSize:16,fontWeight:700,color:pct<40?"var(--red)":pct<80?"var(--gold)":"var(--g700)" }}>{pct}%</div>
          </div>
          <div style={{ width:6,height:52,background:"var(--cream3)",borderRadius:3,overflow:"hidden" }}>
            <div style={{ width:"100%",height:`${pct}%`,background:pct<40?"var(--red)":pct<80?"var(--gold)":"var(--g600)",borderRadius:3,transition:"height .3s",marginTop:`${100-pct}%` }} />
          </div>
        </div>
        {reviewMode && missingFields.length > 0 && (
          <div style={{ padding:"7px 12px",background:"var(--red-l)",border:"1px solid #fca5a5",borderRadius:8,fontSize:12,color:"var(--red)",fontWeight:500 }}>
            ⚠️ {missingFields.length} required field{missingFields.length>1?"s":""} missing
          </div>
        )}
        {reviewMode && missingFields.length === 0 && (
          <div style={{ padding:"7px 12px",background:"var(--g100)",border:"1px solid var(--g200)",borderRadius:8,fontSize:12,color:"var(--g800)",fontWeight:500 }}>
            ✅ All required fields complete
          </div>
        )}
        <button onClick={handleReview} style={{ padding:"8px 16px",background:"var(--cream2)",border:"1.5px solid var(--bdr)",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--txt)" }}>
          🔍 Review
        </button>
        <button onClick={()=>setShowExport(true)} style={{ padding:"8px 18px",background:"var(--g800)",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>
          ↓ Export
        </button>
      </div>
      {/* Main split layout */}
      <div style={{ flex:1,display:"flex",overflow:"hidden" }} className="no-print">
        <ChatPanel sop={sop} formData={formData} onFormUpdate={handleFormUpdate} farmProfile={farmProfile} />
        <FormPanel sop={sop} formData={formData} onChange={handleChange} missingFields={missingFields} />
      </div>
      {/* Print view */}
      <div className="print-content" style={{ display:"none" }}>
        <h1 style={{ fontFamily:"Lora,serif",fontSize:24,color:"#14532d",borderBottom:"2px solid #14532d",paddingBottom:8,marginBottom:16 }}>
          {farmProfile?.farm_name ? `${farmProfile.farm_name} — ` : ""}{sop.title}
        </h1>
        {sop.sections.map(s => (
          <div key={s.id} style={{ marginBottom:24 }}>
            <h2 style={{ fontSize:16,color:"#166534",marginBottom:12 }}>{s.title}</h2>
            {s.fields.map(f => (
              <div key={f.id} style={{ marginBottom:10 }}>
                <strong style={{ fontSize:13 }}>{f.label}: </strong>
                <span style={{ fontSize:13 }}>{formData[f.id] || "___________________________"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {showExport && <ExportModal sop={sop} formData={formData} farmProfile={farmProfile} onClose={()=>setShowExport(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: Dashboard
// ═══════════════════════════════════════════════════════════
function Dashboard({ farmProfile, onSelectSOP, onOpenProfile }) {
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"32px 40px" }}>
      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontFamily:"Lora,serif",fontSize:28,color:"var(--g950)" }}>
          {farmProfile?.farm_name ? `${farmProfile.farm_name}` : "Farm Food Safety Center"}
        </h1>
        <p style={{ fontSize:15,color:"var(--txt2)",marginTop:6 }}>
          FSMA Produce Safety Rule — SOP & Template Management System
        </p>
        {!farmProfile?.farm_name && (
          <button onClick={onOpenProfile} style={{ marginTop:12,padding:"9px 18px",background:"var(--gold-l)",border:"1.5px solid #fcd34d",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,color:"#92400e" }}>
            🌱 Set up your Farm Profile to auto-fill all templates →
          </button>
        )}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16 }}>
        {SOP_DATA.map(sop => (
          <button key={sop.id} onClick={()=>onSelectSOP(sop)}
            style={{ textAlign:"left",padding:"20px",background:"white",border:"1.5px solid var(--bdr2)",borderRadius:14,cursor:"pointer",transition:"all .15s",boxShadow:"var(--shadow)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
              <span style={{ fontSize:28 }}>{sop.icon}</span>
              <span style={{ fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:`${TAG_COLORS[sop.tag]}18`,color:TAG_COLORS[sop.tag],letterSpacing:.5 }}>{sop.tag}</span>
            </div>
            <div style={{ fontFamily:"Lora,serif",fontSize:15,fontWeight:600,color:"var(--g900)",lineHeight:1.3,marginBottom:6 }}>
              {sop.id}. {sop.title}
            </div>
            <p style={{ fontSize:12,color:"var(--txt3)",lineHeight:1.5,marginBottom:10 }}>{sop.desc}</p>
            <div style={{ fontSize:11,color:"var(--g700)",fontWeight:500 }}>→ Open & Fill with AI</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop:40,padding:"20px 24px",background:"var(--g50)",borderRadius:14,border:"1px solid var(--g200)" }}>
        <h3 style={{ fontFamily:"Lora,serif",fontSize:15,color:"var(--g800)",marginBottom:12 }}>📚 Reference Resources</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8 }}>
          {[
            { name:"Cornell PSA Resources", url:"https://producesafetyalliance.cornell.edu/resources" },
            { name:"FDA FSMA Produce Safety Rule", url:"https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-produce-safety" },
            { name:"UC Davis Post-PSA Grower Training", url:"https://ucanr.edu/sites/UCSmallFarmProgram/Food_Safety/" },
            { name:"UMD Sample SOPs & Templates", url:"https://psla.umd.edu/research/produce-safety/produce-safety-resources" },
          ].map(r => (
            <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ display:"block",padding:"8px 12px",background:"white",border:"1px solid var(--g200)",borderRadius:8,fontSize:12,color:"var(--g800)",textDecoration:"none",fontWeight:500 }}>
              🔗 {r.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT: Sidebar
// ═══════════════════════════════════════════════════════════
function Sidebar({ activeSOP, onSelectSOP, onOpenProfile, farmProfile }) {
  return (
    <div style={{ width:240,background:"var(--g950)",color:"white",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
      <div style={{ padding:"24px 20px 18px",borderBottom:"1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontFamily:"Lora,serif",fontSize:17,fontWeight:600,lineHeight:1.2 }}>🌿 FarmSafe</div>
        <div style={{ fontSize:11,color:"rgba(255,255,255,.5)",marginTop:3 }}>FSMA PSR Compliance System</div>
      </div>
      <div style={{ padding:"14px 12px 8px" }}>
        <button onClick={()=>onSelectSOP(null)} style={{ width:"100%",padding:"9px 12px",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",borderRadius:8,color:"white",cursor:"pointer",fontSize:12,fontWeight:500,textAlign:"left",marginBottom:4 }}>
          🏠 Dashboard
        </button>
        <button onClick={onOpenProfile} style={{ width:"100%",padding:"9px 12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:12,textAlign:"left" }}>
          🌱 {farmProfile?.farm_name ? farmProfile.farm_name.slice(0,22) : "My Farm Profile"}
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

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [activeSOP, setActiveSOP] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [farmProfile, setFarmProfile] = useState(null);

  // Load farm profile from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("farm_profile");
        if (result?.value) setFarmProfile(JSON.parse(result.value));
      } catch {}
    })();
    // Handle share link
    const shared = decodeShareLink();
    if (shared) {
      const sop = SOP_DATA.find(s => s.id === shared.sopId);
      if (sop) setActiveSOP({ ...sop, prefillData: shared.formData });
    }
  }, []);

  const saveFarmProfile = async (profile) => {
    setFarmProfile(profile);
    try { await window.storage.set("farm_profile", JSON.stringify(profile)); } catch {}
    setShowProfile(false);
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
      <div style={{ height:"100vh",display:"flex",overflow:"hidden" }}>
        <Sidebar activeSOP={activeSOP} onSelectSOP={setActiveSOP} onOpenProfile={()=>setShowProfile(true)} farmProfile={farmProfile} />
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"var(--cream)" }}>
          {activeSOP ? (
            <SOPEditor sop={activeSOP} farmProfile={farmProfile} onBack={()=>setActiveSOP(null)} />
          ) : (
            <Dashboard farmProfile={farmProfile} onSelectSOP={setActiveSOP} onOpenProfile={()=>setShowProfile(true)} />
          )}
        </div>
      </div>
      {showProfile && <FarmProfileModal profile={farmProfile} onSave={saveFarmProfile} onClose={()=>setShowProfile(false)} />}
    </>
  );
}
