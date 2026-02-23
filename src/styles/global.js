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
  @media print{
    .no-print{display:none!important;}
    .print-content{display:block!important;padding:20px;}
    body{background:white;}
  }
`;

export const TAG_COLORS = {
  CORE: "#005FAE", WATER: "#3AA8E4", SANITATION: "#7c3aed", ACCESS: "#bd8e00",
  INPUTS: "#0071ce", FIELD: "#bd8e00", HARVEST: "#005FAE", RECORDS: "#374151", RESPONSE: "#cc0000",
};
