export const GLOBAL_CSS = `
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

export const TAG_COLORS = {
  CORE: "#166534", WATER: "#0284c7", SANITATION: "#7c3aed", ACCESS: "#b45309",
  INPUTS: "#15803d", FIELD: "#b45309", HARVEST: "#166534", RECORDS: "#374151", RESPONSE: "#dc2626",
};
