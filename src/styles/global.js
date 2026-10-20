export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    /* Modern Navy Palette */
    --u-navy: #002D54;
    --u-navy-d: #001A31;
    --u-navy-l: #004580;
    --u-gold: #FDBD10;
    --u-sky: #3AA8E4;
    
    /* Glassmorphism Tokens */
    --glass-bg: rgba(255, 255, 255, 0.65);
    --glass-bdr: rgba(255, 255, 255, 0.3);
    --blur: blur(12px);
    --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
    
    /* Semantic mapping using Navy palette */
    --g950:#001A31;--g900:#002D54;--g800:#004580;--g700:#005FAE;
    --g600:#3AA8E4;--g200:#cce9f9;--g100:#e5f4fd;--g50:#f8fafc;
    
    --gold: #bd8e00; --gold-l: #fff8e1;
    --cream:#f1f5f9;--cream2:#e2e8f0;--cream3:#cbd5e1;
    --red:#cc0000;--red-l:#fff0f0;
    --sky:#002D54;--sky-l:#e6f2ff;
    
    --txt:#0f172a;--txt2:#334155;--txt3:#64748b;
    --bdr:#cbd5e1;--bdr2:rgba(0,0,0,0.08);

    /* Diced Hero Section Variables */
    --diced-hero-section-top-text: #e0e7ff;
    --diced-hero-section-main-gradient-from: #FDBD10;
    --diced-hero-section-main-gradient-to: #ffffff;
    --diced-hero-section-separator: #FDBD10;
    --diced-hero-section-sub-text: #94a3b8;
    --diced-hero-section-button-bg: #FDBD10;
    --diced-hero-section-button-fg: #001A31;
    --diced-hero-section-button-hover-bg: #ffffff;
    --diced-hero-section-button-hover-fg: #001A31;
    
    --shadow:0 1px 4px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06);
    --shadow-md:0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05);
    --shadow-lg:0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05);

    --fs-base: 16px;
    --fs-sm: 14px;
    --fs-xs: 12px;
    --fs-lg: 18px;
    --fs-xl: 24px;
    --lh-base: 1.6;
  }
  body{
    font-family: 'Inter', -apple-system, sans-serif;
    background: radial-gradient(circle at top left, #f8fafc, #e2e8f0);
    color: var(--txt);
    font-size: var(--fs-base);
    line-height: var(--lh-base);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }
  h1, h2, h3, .serif { font-family: 'Lora', serif; }
  .glass {
    background: var(--glass-bg);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    border: 1px solid var(--glass-bdr);
    box-shadow: var(--glass-shadow);
  }
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--u-navy);border-radius:4px;}
  input,textarea,select{font-family:inherit; font-size: 15px;}

  /* ── Side menu rows and sections (shared with the records screens) ─────────────────────── */
  :root { --menu-text: rgba(255,255,255,0.82); --menu-muted: rgba(255,255,255,0.5); --glass-ease: cubic-bezier(.2,.8,.2,1); }
  .nav-item {
    position: relative; width: 100%; display: flex; align-items: center; gap: 10px;
    min-height: 33px; padding: 6px 12px; border: 1px solid transparent; border-radius: 10px; background: transparent;
    color: var(--menu-text); font: 400 13px/1.2 Inter, sans-serif; text-align: left; cursor: pointer;
    transition: background-color .28s var(--glass-ease), box-shadow .28s var(--glass-ease), border-color .28s var(--glass-ease), color .2s ease;
  }
  .nav-item:hover { background: rgba(255,255,255,0.10); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,0.14); }
  .nav-item:focus-visible { outline: 2px solid #8fd0ff; outline-offset: -2px; }
  .nav-item[aria-current="page"] {
    color: #fff; font-weight: 600; border-color: rgba(253,189,16,0.30);
    background: linear-gradient(135deg, rgba(253,189,16,0.24) 0%, rgba(255,255,255,0.09) 60%, rgba(255,255,255,0.05) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.30), 0 4px 12px rgba(253,189,16,0.08);
  }
  .nav-item svg { flex-shrink: 0; opacity: .9; transition: opacity .2s ease, color .2s ease; }
  .nav-item:hover svg { opacity: 1; }
  .nav-item[aria-current="page"] svg { opacity: 1; color: #ffd24a; }
  .nav-section {
    --section-accent: #9fb4cc; position: relative; margin: 10px 0 0; overflow: hidden; border-radius: 14px;
    background: rgba(0,6,16,0.34); border: 1px solid rgba(255,255,255,0.10); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .nav-section::before {
    content: ""; position: absolute; left: 14px; right: 14px; top: 0; height: 1px; pointer-events: none;
    background: linear-gradient(90deg, rgba(255,255,255,0), var(--section-accent), rgba(255,255,255,0)); opacity: .6;
  }
  .nav-section-header {
    width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 10px 8px; border: 0; background: transparent; cursor: pointer;
    color: #fff; font: 600 12.5px/1.2 Inter, sans-serif; text-align: left; transition: background-color .2s ease;
  }
  .nav-section-header:hover { background: rgba(255,255,255,0.06); }
  .nav-section-header:focus-visible { outline: 2px solid #8fd0ff; outline-offset: -2px; }
  .nav-section-icon {
    width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;
    background: rgba(255,255,255,0.1); color: var(--section-accent);
  }
  @supports (background: color-mix(in srgb, red 20%, transparent)) {
    .nav-section-icon { background: color-mix(in srgb, var(--section-accent) 20%, transparent); }
  }
  .nav-section-title { flex: 1; letter-spacing: .01em; }
  .nav-section-count { min-width: 18px; padding: 2px 6px; border-radius: 9px; background: rgba(255,255,255,0.14); color: #fff; font-size: 10.5px; font-weight: 600; line-height: 1; text-align: center; }
  .nav-section-chevron { flex-shrink: 0; color: rgba(255,255,255,0.65); }
  .nav-section-body { padding: 0 6px 6px; }
  .nav-group-header {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 4px 12px; margin: 14px 0 4px; border: 0; background: transparent; cursor: pointer;
    color: var(--menu-muted); font: 600 10.5px/1.2 Inter, sans-serif; letter-spacing: .09em; text-transform: uppercase;
    transition: color .2s ease;
  }
  .nav-group-header:hover { color: #fff; }
  .nav-group-header:focus-visible { outline: 2px solid #8fd0ff; outline-offset: -2px; border-radius: 6px; }
  .nav-subhead { padding: 8px 12px 2px 50px; color: var(--menu-muted); font: 600 10px/1.2 Inter, sans-serif; letter-spacing: .08em; text-transform: uppercase; }

  /* ── Reports: the page shown on screen, and what the browser prints or saves as PDF ───────── */
  /* A page keeps its width and scrolls sideways in a small window, rather than crushing its columns. */
  .report-doc { box-sizing: border-box; min-width: 860px; background: #fff; color: #0f172a; font: 12px/1.45 Inter, sans-serif; padding: 28px 32px; border: 1px solid #e2e8f0; border-radius: 10px; }
  .report-doc h1 { font: 700 22px/1.2 Lora, serif; margin: 0 0 14px; color: #0f172a; }
  .report-doc h2 { font: 700 14px/1.3 Lora, serif; margin: 22px 0 8px; color: #0f172a; break-after: avoid; }
  .report-meta { margin: 0 0 18px; display: grid; grid-template-columns: max-content 1fr; gap: 3px 16px; }
  .report-meta > div { display: contents; }
  .report-meta dt { font-weight: 600; color: #475569; }
  .report-meta dd { margin: 0; overflow-wrap: anywhere; }
  .report-doc table { width: 100%; border-collapse: collapse; margin: 0 0 6px; font-size: 11px; }
  .report-doc th { text-align: left; background: #e2e8f0; font-weight: 600; padding: 5px 7px; border: 1px solid #cbd5e1; }
  .report-doc td { padding: 5px 7px; border: 1px solid #cbd5e1; vertical-align: top; overflow-wrap: anywhere; }
  .report-doc td.report-date { white-space: nowrap; }
  .report-doc .report-summary { width: auto; min-width: 280px; margin-bottom: 8px; }
  .report-doc .report-note { color: #64748b; font-style: italic; margin: 10px 0; }
  .report-sign { display: grid; grid-template-columns: 5fr 5fr 3fr; gap: 24px; margin-top: 40px; font-size: 11px; color: #475569; break-inside: avoid; }
  .report-line { display: block; height: 28px; border-bottom: 1px solid #0f172a; margin-bottom: 4px; }
  .report-foot { margin: 22px 0 0; font-size: 10px; color: #64748b; }
  .print-only { display: none; }
  @page report { size: landscape; margin: 12mm; }

  @media print{
    .no-print{display:none!important;}
    .print-content{display:block!important;padding:20px;}
    body{background:white;}
    /* Printing a report: show only the report (the class is set just while the print window is open). */
    body.printing-report > *:not(.print-only) { display: none !important; }
    body.printing-report .print-only { display: block !important; page: report; }
    .print-only .report-doc { min-width: 0; border: 0; border-radius: 0; padding: 0; font-size: 9pt; }
    .print-only .report-doc table { font-size: 8.5pt; }
    .print-only .report-doc tr { break-inside: avoid; }
    .print-only .report-doc thead { display: table-header-group; }
  }
`;

export const TAG_COLORS = {
  CORE: "#005FAE", WATER: "#3AA8E4", SANITATION: "#7c3aed", ACCESS: "#bd8e00",
  INPUTS: "#0071ce", FIELD: "#bd8e00", HARVEST: "#005FAE", RECORDS: "#374151", RESPONSE: "#cc0000",
};
