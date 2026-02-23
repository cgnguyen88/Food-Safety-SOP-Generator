import { SOP_DATA } from "../data/sop-data.js";
import { TAG_COLORS } from "../styles/global.js";

export default function Dashboard({ farmProfile, onSelectSOP, onOpenProfile }) {
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
            Set up your Farm Profile to auto-fill all templates →
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
        <h3 style={{ fontFamily:"Lora,serif",fontSize:15,color:"var(--g800)",marginBottom:12 }}>Reference Resources</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8 }}>
          {[
            { name:"Cornell PSA Resources", url:"https://producesafetyalliance.cornell.edu/resources" },
            { name:"FDA FSMA Produce Safety Rule", url:"https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-produce-safety" },
            { name:"UC Davis Post-PSA Grower Training", url:"https://ucanr.edu/sites/UCSmallFarmProgram/Food_Safety/" },
            { name:"UMD Sample SOPs & Templates", url:"https://psla.umd.edu/research/produce-safety/produce-safety-resources" },
          ].map(r => (
            <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ display:"block",padding:"8px 12px",background:"white",border:"1px solid var(--g200)",borderRadius:8,fontSize:12,color:"var(--g800)",textDecoration:"none",fontWeight:500 }}>
              {r.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
