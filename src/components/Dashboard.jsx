import { SOP_DATA } from "../data/sop-data.js";
import { TAG_COLORS } from "../styles/global.js";
import { DicedHeroSection } from "./ui/diced-hero-section.tsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";

export default function Dashboard({ onSelectSOP, farmProfile, onOpenProfile, onNavigate }) {
  const { lang } = useLanguage();
  const d = T[lang].dashboard;
  const localizedSops = SOP_DATA.map(sop => getLocalizedSop(sop, lang));

  const slides = [
    { title: "Berry Harvest", image: "https://images.unsplash.com/photo-1623227866882-c005c26dfe41?auto=format&fit=crop&q=80&w=1000" },
    { title: "Farm Training", image: "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?auto=format&fit=crop&q=80&w=1000" },
    { title: "Fresh Produce", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1000" },
    { title: "Water Safety", image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", background: "var(--cream)" }}>
      <DicedHeroSection
        topText={d.topText}
        mainText={d.mainText}
        subMainText={d.subText}
        buttonText={d.getStarted}
        slides={slides}
        onMainButtonClick={() => onSelectSOP(SOP_DATA[0])}
        topTextStyle={{ color: "var(--u-gold)", fontWeight: 700, fontSize: "14px", letterSpacing: "2px", textTransform: "uppercase" }}
        mainTextStyle={{
          fontSize: "4.5rem",
          fontWeight: 900,
          gradient: "linear-gradient(to right, var(--u-gold), #ffffff)",
          lineHeight: "1.1"
        }}
        subMainTextStyle={{ color: "#cbd5e1", fontSize: "1.1rem", marginTop: "1.5rem", maxWidth: "500px" }}
        buttonStyle={{
          backgroundColor: "var(--u-gold)",
          color: "#001A31",
          borderRadius: "14px",
          hoverColor: "#ffffff",
          hoverForeground: "#001A31",
        }}
        backgroundColor="var(--u-navy-d)"
        componentBorderRadius="32px"
        separatorColor="var(--u-gold)"
        maxContentWidth="100%"
        fontFamily="'Inter', sans-serif"
      />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 40, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "Lora,serif", fontSize: 32, color: "var(--u-navy)", fontWeight: 800, letterSpacing: "-0.02em" }}>{d.sopGenerator}</h1>
          <p style={{ fontSize: 15, color: "var(--txt3)", marginTop: 6 }}>{d.sopSubtitle}</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => onNavigate("plan_generator")}
            style={{ padding: "14px 28px", background: "var(--u-sky)", color: "white", border: "none", borderRadius: 14, cursor: "pointer", fontSize: 14, fontWeight: 800, boxShadow: "0 6px 18px rgba(58,168,228,0.4)" }}
          >
            📋 {d.foodSafetyPlan}
          </button>
          <button
            onClick={onOpenProfile}
            style={{ padding: "14px 28px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: 14, cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 14px rgba(253,189,16,0.3)" }}
          >
            {farmProfile ? d.editProfile : d.setupProfile}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {localizedSops.map((sop, idx) => (
          <div key={sop.id} className="glass" style={{
            padding: "28px", borderRadius: 22, cursor: "pointer",
            transition: "all .3s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex", flexDirection: "column", gap: 14,
            position: "relative", overflow: "hidden"
          }} onClick={() => onSelectSOP(SOP_DATA[idx])}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>{sop.icon}</div>
            <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--u-navy)" }}>{sop.title}</h3>
            <p style={{ fontSize: 14, color: "var(--txt2)", lineHeight: 1.6, flex: 1 }}>{sop.desc}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--u-navy-l)", letterSpacing: 1, textTransform: "uppercase" }}>{sop.short}</span>
              <span style={{ color: "var(--u-navy)", fontWeight: 700, fontSize: 18 }}>→</span>
            </div>
            <div style={{
              position: "absolute", bottom: 0, left: 0, width: "100%", height: 4,
              background: `linear-gradient(90deg, var(--u-navy), var(--u-sky))`,
              opacity: 0.8
            }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 40, padding: "20px 24px", background: "var(--g50)", borderRadius: 14, border: "1px solid var(--g200)" }}>
        <h3 style={{ fontFamily: "Lora,serif", fontSize: 15, color: "var(--g800)", marginBottom: 12 }}>{d.resources}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
          {[
            { name: "Cornell PSA Resources", url: "https://producesafetyalliance.cornell.edu/resources" },
            { name: "FDA FSMA Produce Safety Rule", url: "https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-produce-safety" },
            { name: "UC Davis Post-PSA Grower Training", url: "https://ucanr.edu/sites/UCSmallFarmProgram/Food_Safety/" },
            { name: "UMD Sample SOPs & Templates", url: "https://psla.umd.edu/research/produce-safety/produce-safety-resources" },
          ].map(r => (
            <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", padding: "8px 12px", background: "white", border: "1px solid var(--g200)", borderRadius: 8, fontSize: 12, color: "var(--g800)", textDecoration: "none", fontWeight: 500 }}>
              {r.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
