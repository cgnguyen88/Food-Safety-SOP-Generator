import { FIELD_SUGGESTIONS } from "./field-suggestions.js";

const RAW_SOP_DATA = [
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
        { id: "cleaning_steps", label: "Step-by-Step Cleaning Procedure", type: "textarea", required: true, ph: "1. Remove visible debris/organic matter\n2. Rinse with potable water\n3. Apply detergent, scrub thoroughly\n4. Rinse to remove detergent residue\n5. Apply sanitizer solution\n6. Allow contact time per label\n7. Air dry" },
        { id: "cleaning_freq", label: "Cleaning Frequency by Surface Type", type: "textarea", required: true, ph: "Harvest tools: daily / between crops\nHarvest bins: before each use\nPacking tables: before each shift" },
        { id: "pre_op_check", label: "Pre-Operation Inspection Procedure", type: "textarea", ph: "Visual inspection before each harvest/packing shift" },
      ]},
      { id: "sanitizer", title: "Sanitizer Information", fields: [
        { id: "sanitizer_type", label: "Sanitizer Type / Product Name", type: "text", required: true, ph: "Quaternary ammonium / Chlorine (bleach solution) / Peroxyacetic acid" },
        { id: "sanitizer_concentration", label: "Use Concentration", type: "text", required: true, ph: "200 ppm quaternary ammonium; 100-200 ppm chlorine" },
        { id: "contact_time", label: "Required Contact Time", type: "text", required: true, ph: "Per label — typically 30 seconds to 2 minutes" },
        { id: "test_strip_type", label: "Test Strip / Verification Method", type: "text", required: true, ph: "QAC test strips (0-500 ppm range); chlorine test strips" },
        { id: "test_freq", label: "Concentration Verification Frequency", type: "text", ph: "At start of each batch prepared / every 2 hours during use" },
        { id: "sds_location", label: "Safety Data Sheet (SDS) Location", type: "text", ph: "Posted in chemical storage room / packing shed bulletin board" },
        { id: "sanitizer_storage", label: "Sanitizer Storage Location & Conditions", type: "textarea", ph: "Locked chemical storage cabinet, away from food/produce" },
        { id: "corrective_action_fail", label: "Corrective Action if Concentration Fails", type: "textarea", ph: "Discard batch, prepare new solution, re-test, document in log" },
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
        { id: "source_description", label: "Detailed Source Description", type: "textarea", required: true, ph: "Describe: location, ownership, shared or dedicated use, infrastructure" },
        { id: "crops_irrigated", label: "Crops / Fields Served", type: "textarea", ph: "Block A (5 acres leafy greens), Block B (3 acres tomatoes)..." },
      ]},
      { id: "risk", title: "Risk Assessment", fields: [
        { id: "upstream_risks", label: "Upstream / Adjacent Land Use Risks", type: "textarea", required: true, ph: "Animal operations, residential areas with septic, recreational use, flooding zones..." },
        { id: "historical_issues", label: "Historical Contamination Issues or Concerns", type: "textarea", ph: "Previous test failures, visible pollution events, flooding incidents..." },
        { id: "infrastructure_risks", label: "Infrastructure / Delivery Risks", type: "textarea", ph: "Cross-connections, backflow risks, unsealed well, deteriorated pipe..." },
        { id: "risk_level", label: "Overall Risk Level", type: "select", options: ["Low — enclosed groundwater, low adjacent risk, consistent clean test history","Medium — some risk factors present, requires monitoring","High — surface water, adjacent animal operations, test failures, flooding risk"], required: true },
        { id: "risk_justification", label: "Risk Level Justification", type: "textarea", required: true, ph: "Explain the factors that led to this risk classification" },
      ]},
      { id: "controls", title: "Risk Management & Corrective Actions", fields: [
        { id: "current_controls", label: "Current Control Measures", type: "textarea", required: true, ph: "Drip irrigation to minimize direct contact, buffer strips maintained, well sealed..." },
        { id: "corrective_actions_plan", label: "Corrective Actions if Issues Identified", type: "textarea", required: true, ph: "Stop use of water source immediately, do not harvest, investigate contamination source..." },
        { id: "contingency_source", label: "Backup / Alternative Water Source", type: "text", ph: "Municipal supply connection available for emergency use" },
      ]},
      { id: "review", title: "Assessment Review", fields: [
        { id: "review_frequency", label: "Assessment Review Frequency", type: "select", options: ["Annually","Semi-annually","After any significant event (flooding, upstream change)","Annually + after significant events"], required: true },
        { id: "trigger_events", label: "Events Triggering Immediate Reassessment", type: "textarea", ph: "Flooding, significant rainfall event, upstream spill, system damage..." },
        { id: "assessor_training", label: "Assessor Training / Qualifications", type: "text", ph: "PSA Grower Training, farm operator with [X] years experience" },
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
        { id: "sampling_locations", label: "Sampling Point Locations", type: "textarea", required: true, ph: "Well head, end of distribution line, irrigation delivery point..." },
        { id: "sampling_method", label: "Sample Collection Method", type: "textarea", required: true, ph: "Use sterile 100mL Whirl-Pak bag; wear gloves; collect from flowing water..." },
        { id: "sample_volume", label: "Sample Volume Required", type: "text", ph: "100 mL minimum for generic E. coli" },
        { id: "sampling_frequency", label: "Testing Frequency", type: "select", options: ["Single annual sample (groundwater — low risk)","3 samples/year minimum","Annual geometric mean (surface water — ≥5 samples over 2-3 years)","Monthly during season","Per buyer requirement"], required: true },
        { id: "who_samples", label: "Person Responsible for Sampling", type: "text", ph: "Farm manager or designated trained employee" },
      ]},
      { id: "coc", title: "Chain of Custody & Lab", fields: [
        { id: "lab_name", label: "Testing Laboratory Name", type: "text", required: true, ph: "State Certified Environmental Lab" },
        { id: "lab_contact", label: "Lab Contact & Address", type: "textarea", ph: "Contact name, phone, email, physical address" },
        { id: "lab_certification", label: "Lab Certification / Accreditation", type: "text", ph: "State-certified for drinking water analysis; NELAC/TNI accredited" },
        { id: "coc_procedure", label: "Chain-of-Custody Procedure", type: "textarea", required: true, ph: "Complete lab-provided COC form at time of collection; keep samples at ≤10°C..." },
        { id: "holding_time", label: "Maximum Sample Holding Time", type: "text", ph: "6 hours from collection to lab receipt" },
        { id: "parameters_tested", label: "Parameters Tested", type: "text", ph: "Generic E. coli (CFU/100 mL); Total coliform" },
      ]},
      { id: "results", title: "Results Management", fields: [
        { id: "acceptable_limits", label: "Acceptable Limits", type: "textarea", required: true, ph: "Pre-harvest: ≤235 CFU/100 mL (STV); ≤126 CFU/100 mL (GM)" },
        { id: "action_on_exceedance", label: "Action if Results Exceed Limits", type: "textarea", required: true, ph: "1. Immediately discontinue use\n2. Do not harvest\n3. Investigate source\n4. Resample and retest" },
        { id: "record_location", label: "Test Results Record Location", type: "text", ph: "Food safety binder, Section 5" },
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
        { id: "amendment_types_used", label: "Types of Biological Soil Amendments Used", type: "textarea", required: true, ph: "Raw manure, Composted manure, Commercial biosolids..." },
        { id: "amendment_sources", label: "Suppliers / Sources", type: "textarea", required: true, ph: "Name, address, and contact for each supplier" },
      ]},
      { id: "treatment", title: "Treatment Verification", fields: [
        { id: "compost_standards", label: "Standards Used for Treated/Composted Amendments", type: "textarea", ph: "NOP composting standards: 55-77°C for 15 days with ≥5 turnings" },
        { id: "treatment_records", label: "Treatment Records Obtained from Supplier", type: "select", options: ["Yes — temperature logs and certificates provided","Yes — batch-level certificates only","No — not currently obtained","N/A — only using commercial certified compost"] },
        { id: "pathogen_testing", label: "Pathogen Testing of Amendments", type: "select", options: ["Yes — Salmonella and generic E. coli tested per NOP","Yes — tested per buyer requirement","No — relying on supplier documentation","N/A"] },
      ]},
      { id: "handling", title: "Storage & Handling", fields: [
        { id: "storage_location", label: "Storage Location", type: "text", required: true, ph: "Covered pile / enclosed shed, >150 ft from water sources" },
        { id: "storage_conditions", label: "Storage Conditions & Controls", type: "textarea", ph: "Bermed to prevent runoff, covered when not in use..." },
        { id: "handling_procedure", label: "Handling Procedures", type: "textarea", ph: "Dedicated equipment used for amendments..." },
      ]},
      { id: "application", title: "Application Procedures", fields: [
        { id: "application_method", label: "Application Method", type: "select", options: ["Incorporated into soil (tillage)","Surface application — no incorporation","Broadcast prior to planting","Side-dress during season","Irrigation injection (fertigation)","Other"] },
        { id: "application_timing", label: "Application Timing / Intervals", type: "textarea", required: true, ph: "Raw manure: minimum 120-day pre-harvest interval (PHI)..." },
        { id: "setback_distances", label: "Setback Distances Maintained", type: "textarea", ph: ">150 ft from water sources..." },
        { id: "application_rate", label: "Application Rate", type: "text", ph: "Per soil test recommendations" },
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
        { id: "assessor_name", label: "Designated Field Assessor(s)", type: "text", required: true, ph: "Name(s) and role(s)" },
      ]},
      { id: "monitoring", title: "Monitoring Program", fields: [
        { id: "monitoring_timing", label: "When Assessments Are Conducted", type: "textarea", required: true, ph: "Immediately before each harvest event" },
        { id: "monitoring_method", label: "Assessment Method", type: "textarea", required: true, ph: "Walk perimeter, look for tracks/trails/feces/burrows/disturbed soil" },
        { id: "wildlife_types", label: "Wildlife of Concern at This Location", type: "textarea", ph: "Deer, wild pig, ground squirrels, birds, coyotes..." },
        { id: "seasonal_risks", label: "High-Risk Seasons / Conditions", type: "textarea", ph: "Migration season, drought, adjacent grazing turnout periods..." },
      ]},
      { id: "intrusion_signs", title: "Intrusion Indicators", fields: [
        { id: "intrusion_signs", label: "Signs That Trigger No-Harvest Protocol", type: "textarea", required: true, ph: "Animal feces, tracks or trails, carcass, visible crop damage..." },
        { id: "no_harvest_zone", label: "No-Harvest Zone Definition", type: "textarea", required: true, ph: "Minimum 5-foot radius around any feces..." },
      ]},
      { id: "prevention", title: "Prevention Measures", fields: [
        { id: "exclusion_methods", label: "Physical Exclusion / Deterrent Methods Used", type: "textarea", ph: "Perimeter fencing, bird netting, exclusion wire, cameras, deterrent lights..." },
        { id: "buffer_management", label: "Buffer Zone / Border Area Management", type: "textarea", ph: "Vegetation management at field edges, removal of brush piles..." },
      ]},
      { id: "response", title: "Response Procedures", fields: [
        { id: "intrusion_response", label: "Steps When Intrusion Is Found", type: "textarea", required: true, ph: "1. Mark affected area\n2. Define no-harvest zone\n3. Document findings\n4. Notify supervisor" },
        { id: "harvest_decision", label: "Harvest Decision Authority", type: "text", ph: "Farm manager or designated supervisor" },
        { id: "disposal_procedure", label: "Cull / Contaminated Produce Disposal", type: "textarea", ph: "Do not donate, feed to animals, or sell; document quantity disposed" },
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
        { id: "preop_timing", label: "When Pre-Op Inspection Occurs", type: "text", required: true, ph: "Before each harvest shift begins" },
        { id: "preop_checklist", label: "Pre-Op Inspection Items", type: "textarea", required: true, ph: "Harvest bins clean, tools sanitized, worker hygiene verified, field conditions checked..." },
        { id: "preop_authority", label: "Who Conducts Pre-Op Inspection", type: "text", ph: "Harvest supervisor / designated lead worker" },
        { id: "preop_fail_action", label: "Action if Pre-Op Fails", type: "textarea", ph: "Do not begin harvest; correct issue; re-inspect; document" },
      ]},
      { id: "tools_containers", title: "Tools & Container Management", fields: [
        { id: "tool_inspection_criteria", label: "Tool Acceptance / Rejection Criteria", type: "textarea", required: true, ph: "Reject tools that are rusty, cracked, cannot be sanitized..." },
        { id: "container_criteria", label: "Container / Bin Acceptance Criteria", type: "textarea", required: true, ph: "Food-grade, free of cracks, clean and sanitized..." },
        { id: "damaged_container_action", label: "Action for Damaged / Contaminated Containers", type: "textarea", ph: "Remove from service immediately; tag with 'Do Not Use'" },
        { id: "dedicated_equipment", label: "Food vs. Non-Food Equipment Designation", type: "textarea", ph: "Color-coded: red = non-food, green = produce use only" },
      ]},
      { id: "handling", title: "Handling Practices", fields: [
        { id: "hygiene_during_harvest", label: "Worker Hygiene During Harvest", type: "textarea", required: true, ph: "Wash hands before harvest and after any break..." },
        { id: "produce_protection", label: "Produce Protection Measures", type: "textarea", ph: "Keep bins shaded, minimize time from field to cooler..." },
        { id: "temperature_control", label: "Temperature Control Requirements", type: "textarea", ph: "Field heat removal target, transport temperature requirements..." },
        { id: "postharvest_water", label: "Postharvest Wash / Cooling Water", type: "textarea", ph: "Use potable water only; maintain chlorine level..." },
      ]},
      { id: "culls", title: "Cull Management & Contamination Response", fields: [
        { id: "cull_procedure", label: "Cull Management Procedure", type: "textarea", required: true, ph: "Remove damaged produce immediately; place in marked cull bins..." },
        { id: "contamination_response", label: "Contamination Event Response Protocol", type: "textarea", required: true, ph: "1. Stop harvest immediately\n2. Segregate affected produce\n3. Notify supervisor..." },
        { id: "foreign_material", label: "Foreign Material Control", type: "textarea", ph: "Pre-harvest field sweep for glass, metal, plastic..." },
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
        { id: "lot_code_method", label: "Lot Code System Description", type: "textarea", required: true, ph: "Julian date + farm ID + field block" },
        { id: "lot_code_format", label: "Lot Code Format Example", type: "text", required: true, ph: "GVF-LETTUCE-20250703-A1" },
        { id: "lot_code_placement", label: "Where Lot Code Appears on Product", type: "textarea", ph: "Printed on case/bag label; handwritten on field tag" },
        { id: "smallest_traceable_unit", label: "Smallest Traceable Unit", type: "text", ph: "Individual case / pallet / bin" },
        { id: "lot_code_records_kept", label: "Records Linking Lot Code to Source", type: "textarea", required: true, ph: "Each lot code traceable to: harvest date, field, crop, crew..." },
      ]},
      { id: "shipping", title: "Shipment & Customer Records", fields: [
        { id: "customer_record_content", label: "Information Captured in Shipment Records", type: "textarea", required: true, ph: "Customer name, address, phone; delivery date; lot code(s); product; quantity" },
        { id: "record_system", label: "Record-Keeping System Used", type: "text", ph: "Paper log books; QuickBooks; spreadsheet; farm management software" },
        { id: "record_retention", label: "Record Retention Period", type: "text", required: true, ph: "Minimum 2 years per FSMA PSR; 3 years recommended" },
        { id: "record_location", label: "Records Location / Access", type: "text", ph: "Farm office filing cabinet + digital backup" },
      ]},
      { id: "recall", title: "Mock Recall & Recall Response", fields: [
        { id: "mock_recall_frequency", label: "Mock Recall Frequency", type: "select", options: ["Annually","Semi-annually","Quarterly","Not yet established"], required: true },
        { id: "last_mock_recall", label: "Date of Last Mock Recall Exercise", type: "date" },
        { id: "recall_trigger", label: "Events That Trigger a Real Recall", type: "textarea", required: true, ph: "Customer complaint of illness, positive pathogen test, confirmed contamination..." },
        { id: "recall_steps", label: "Recall Initiation Steps", type: "textarea", required: true, ph: "1. Notify Recall Coordinator\n2. Identify affected lot codes\n3. Contact customers\n4. Hold inventory\n5. Notify FDA if required" },
        { id: "recall_24hr_goal", label: "Trace-Back / Trace-Forward Time Goal", type: "text", ph: "Identify all recipients of any lot within 2 hours" },
        { id: "regulatory_contacts", label: "Regulatory Contacts", type: "textarea", ph: "FDA District Office, State Dept of Agriculture" },
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
    desc: "What to do when contamination is suspected — broken glass, sewage overflow, sick worker, sanitizer failure, or water concern.",
    sections: [
      { id: "meta", title: "Document Information", fields: [
        { id: "farm_name", label: "Farm Name", type: "text", required: true, ph: "Green Valley Farm" },
        { id: "effective_date", label: "Effective Date", type: "date", required: true },
        { id: "prepared_by", label: "Prepared By", type: "text", required: true },
        { id: "primary_contact", label: "Primary Decision-Maker for Incidents", type: "text", required: true, ph: "Owner / Farm Manager: Name, cell phone" },
      ]},
      { id: "scenarios", title: "Covered Incident Scenarios", fields: [
        { id: "contamination_scenarios", label: "Types of Incidents This SOP Covers", type: "textarea", required: true, ph: "Biological, Physical, Chemical, Microbiological, Facility incidents" },
      ]},
      { id: "immediate", title: "Immediate Response Protocol", fields: [
        { id: "stop_work_criteria", label: "Stop Work / Stop Harvest Criteria", type: "textarea", required: true, ph: "Any confirmed or suspected contamination of produce contact surfaces or product..." },
        { id: "immediate_steps", label: "Immediate Response Steps (First 30 Minutes)", type: "textarea", required: true, ph: "1. STOP work\n2. Segregate affected product\n3. Isolate the area\n4. Notify decision-maker\n5. Ensure worker safety\n6. Document" },
        { id: "notification_contacts", label: "Notification Chain", type: "textarea", required: true, ph: "Internal: Farm owner → Farm manager → Food safety coordinator..." },
      ]},
      { id: "investigation", title: "Investigation & Root Cause", fields: [
        { id: "investigation_steps", label: "Investigation Procedure", type: "textarea", required: true, ph: "1. Identify scope of affected product\n2. Identify time period\n3. Trace back through records\n4. Interview workers\n5. Review logs\n6. Document" },
        { id: "root_cause_analysis", label: "Root Cause Analysis Method", type: "textarea", ph: "5-Why analysis; Fishbone/Ishikawa diagram; Timeline reconstruction" },
      ]},
      { id: "disposition", title: "Product Disposition", fields: [
        { id: "hold_procedure", label: "Product Hold Procedure", type: "textarea", required: true, ph: "Tag all affected product with 'HOLD — Do Not Ship'" },
        { id: "disposition_options", label: "Disposition Decision Options", type: "textarea", required: true, ph: "1. RELEASE  2. DIVERT  3. DESTROY  4. RECALL" },
        { id: "release_authority", label: "Who Has Authority to Release Held Product", type: "text", ph: "Farm owner or designated food safety manager ONLY" },
      ]},
      { id: "prevention", title: "Corrective Action & Prevention", fields: [
        { id: "corrective_action_process", label: "Corrective Action Development Process", type: "textarea", required: true, ph: "Develop specific corrective action, assign responsible person and deadline..." },
        { id: "return_to_operation", label: "Return-to-Operation Criteria", type: "textarea", required: true, ph: "Root cause addressed, corrective action implemented, area cleaned..." },
        { id: "fsma_notification", label: "FSMA / Regulatory Notification Requirements", type: "textarea", ph: "FDA Emergency Line: 1-866-300-4374 (24/7)" },
      ]},
    ],
    log: { title: "Corrective Action & Incident Log", cols: ["Incident Date","Discovered By","Time Discovered","Incident Type","Description","Immediate Action Taken","Product Affected (Lot #s)","Quantity on Hold","Root Cause","Corrective Action","Product Disposition","Resolved Date","Decision Made By","Sign-off"] },
  },
];

// Apply checkbox field types from field-suggestions
RAW_SOP_DATA.forEach(sop => {
  sop.sections.forEach(section => {
    section.fields.forEach(field => {
      if (FIELD_SUGGESTIONS[field.id]) {
        field.type = "checkbox-multiple";
        field.checkboxOptions = FIELD_SUGGESTIONS[field.id];
      }
    });
  });
});

export const SOP_DATA = RAW_SOP_DATA;
