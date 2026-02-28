import { useState } from "react";
import { Eye, EyeOff, Leaf, ShieldCheck, FlaskConical, Tractor } from "lucide-react";
import { loadFromStorage, saveToStorage } from "../utils/storage.js";

/* ─── shared style helpers ─── */
const inputStyle = (focused) => ({
  display: "flex",
  height: 40,
  width: "100%",
  borderRadius: 6,
  border: `1.5px solid ${focused ? "var(--g700)" : "var(--bdr)"}`,
  background: "white",
  padding: "0 12px",
  fontSize: 14,
  color: "var(--txt)",
  outline: "none",
  boxShadow: focused ? "0 0 0 3px rgba(0,69,128,0.10)" : "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
});

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--txt2)",
  marginBottom: 6,
};

/* ─── reusable Field ─── */
function Field({ label, id, type = "text", value, onChange, placeholder, required, suffix }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle(focused), paddingRight: suffix ? 42 : 12 }}
        />
        {suffix}
      </div>
    </div>
  );
}

/* ─── password field with show/hide toggle ─── */
function PasswordField({ label, id, value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle(focused), paddingRight: 42 }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            width: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--txt3)",
            padding: 0,
          }}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

/* ─── styled native select ─── */
function SelectField({ label, id, value, onChange, options, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...inputStyle(focused),
            appearance: "none",
            paddingRight: 36,
            cursor: "pointer",
            color: value ? "var(--txt)" : "var(--txt3)",
          }}
        >
          <option value="" disabled>Select role…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {/* chevron */}
        <span style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", color: "var(--txt3)",
        }}>
          ▾
        </span>
      </div>
    </div>
  );
}

/* ─── custom checkbox ─── */
function CheckboxField({ id, checked, onChange, children }) {
  return (
    <label
      htmlFor={id}
      style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", userSelect: "none" }}
    >
      <div style={{ position: "relative", marginTop: 2, flexShrink: 0 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 16, height: 16, cursor: "pointer" }}
        />
        <div style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1.5px solid ${checked ? "var(--g800)" : "var(--bdr)"}`,
          background: checked ? "var(--g800)" : "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
        }}>
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <span style={{ fontSize: 13, color: "var(--txt3)", lineHeight: 1.5 }}>{children}</span>
    </label>
  );
}

/* ─── FarmSafe SVG logo ─── */
function FarmSafeLogo() {
  return (
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 12,
      background: "linear-gradient(135deg, var(--g900) 0%, var(--g800) 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 24,
      boxShadow: "0 4px 12px rgba(0,45,84,0.25)",
    }}>
      🌿
    </div>
  );
}

/* ─── role options ─── */
const ROLE_OPTIONS = [
  { value: "owner", label: "Farm Owner / Operator", Icon: Tractor },
  { value: "fsm", label: "Food Safety Manager", Icon: ShieldCheck },
  { value: "consultant", label: "Consultant / Auditor", Icon: FlaskConical },
  { value: "supervisor", label: "Harvest Supervisor", Icon: Leaf },
  { value: "other", label: "Other", Icon: null },
];

/* ════════════════════════════════════════════
   Main AuthScreen component
═══════════════════════════════════════════ */
export default function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState("register");
  const [error, setError] = useState("");

  /* login state */
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  /* registration state */
  const [role, setRole] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regOrg, setRegOrg] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);

  const users = () => loadFromStorage("user_accounts", []);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    const user = users().find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.password === loginPassword
    );
    if (!user) { setError("Invalid email or password. Please try again."); return; }
    saveToStorage("current_user", user);
    onLogin(user);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !regOrg.trim() || !role) {
      setError("Please fill in all required fields."); return;
    }
    if (!regEmail.includes("@")) { setError("Please enter a valid email address."); return; }
    if (regPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (regPassword !== regConfirm) { setError("Passwords do not match."); return; }
    if (!agreedTerms) { setError("Please accept the Terms & Conditions to continue."); return; }

    const all = users();
    if (all.find((u) => u.email.toLowerCase() === regEmail.trim().toLowerCase())) {
      setError("An account with this email already exists. Please sign in."); return;
    }

    const newUser = {
      id: Date.now(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: regEmail.trim().toLowerCase(),
      phone: regPhone.trim(),
      organization: regOrg.trim(),
      role,
      password: regPassword,
      createdAt: new Date().toISOString(),
    };

    saveToStorage("user_accounts", [...all, newUser]);
    saveToStorage("current_user", newUser);
    onLogin(newUser);
  };

  const switchTab = (t) => { setTab(t); setError(""); };

  /* ─── card container styles ─── */
  const cardStyle = {
    background: "white",
    borderRadius: 16,
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 40px -8px rgba(0,0,0,0.12)",
    border: "1px solid var(--bdr2)",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "radial-gradient(circle at top left, #f8fafc, #e2e8f0)",
    }}>
      {/* ── Left branding panel ── */}
      <div style={{
        width: "40%",
        background: "linear-gradient(160deg, var(--u-navy-d) 0%, var(--g800) 60%, var(--u-navy-l) 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 48px",
        color: "white",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* decorative circles */}
        <div style={{ position:"absolute", top:-80, right:-80, width:320, height:320, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
        <div style={{ position:"absolute", bottom:-100, left:-60, width:280, height:280, borderRadius:"50%", background:"rgba(253,189,16,0.08)" }} />

        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"var(--u-gold)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:32, boxShadow:"0 4px 16px rgba(253,189,16,0.35)" }}>
            🌿
          </div>
          <h1 style={{ fontFamily:"Lora,serif", fontSize:32, fontWeight:700, lineHeight:1.2, marginBottom:16, color:"white" }}>
            Food Safety<br />SOP Assistant
          </h1>
          <p style={{ fontSize:15, lineHeight:1.7, color:"rgba(255,255,255,0.72)", marginBottom:40 }}>
            Build FSMA-compliant Standard Operating Procedures with AI-powered assistance. Tailored for farms, food operations, and safety managers.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {[
              { icon:"📋", text:"10 ready-made SOP templates" },
              { icon:"🤖", text:"AI-powered field suggestions" },
              { icon:"📊", text:"Violation tracking & cost analysis" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                  {icon}
                </div>
                <span style={{ fontSize:14, color:"rgba(255,255,255,0.8)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        flex:1,
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        padding:"32px 24px",
        overflowY:"auto",
      }}>
        {tab === "register" ? (
          /* ══════════ REGISTRATION CARD ══════════ */
          <div style={cardStyle}>
            {/* Card header */}
            <div style={{ padding:"28px 28px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, borderBottom:"1px solid var(--bdr2)" }}>
              <FarmSafeLogo />
              <div style={{ textAlign:"center" }}>
                <h2 style={{ fontFamily:"Lora,serif", fontSize:22, fontWeight:700, color:"var(--g900)", margin:0 }}>
                  Create an account
                </h2>
                <p style={{ fontSize:13, color:"var(--txt3)", marginTop:4 }}>
                  Welcome! Fill in your details to get started.
                </p>
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding:"24px 28px", overflowY:"auto" }}>
              {error && (
                <div style={{ padding:"10px 14px", background:"var(--red-l)", border:"1.5px solid #fca5a5", borderRadius:8, fontSize:13, color:"var(--red)", marginBottom:16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister}>
                <SelectField
                  label="Role"
                  id="reg-role"
                  value={role}
                  onChange={setRole}
                  options={ROLE_OPTIONS}
                  required
                />

                {/* First + Last name grid */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:0 }}>
                  <Field label="First name" id="reg-first" value={firstName} onChange={setFirstName} placeholder="Jane" required />
                  <Field label="Last name"  id="reg-last"  value={lastName}  onChange={setLastName}  placeholder="Smith" required />
                </div>

                <Field
                  label="Email address"
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={setRegEmail}
                  placeholder="jane@example.com"
                  required
                />
                <Field
                  label="Phone number"
                  id="reg-phone"
                  type="tel"
                  value={regPhone}
                  onChange={setRegPhone}
                  placeholder="(555) 123-4567"
                />
                <Field
                  label="Organization / Farm name"
                  id="reg-org"
                  value={regOrg}
                  onChange={setRegOrg}
                  placeholder="Green Valley Farm"
                  required
                />
                <PasswordField
                  label="Password"
                  id="reg-password"
                  value={regPassword}
                  onChange={setRegPassword}
                  placeholder="At least 6 characters"
                  required
                />
                <PasswordField
                  label="Confirm password"
                  id="reg-confirm"
                  value={regConfirm}
                  onChange={setRegConfirm}
                  placeholder="Re-enter your password"
                  required
                />

                <div style={{ marginBottom:20 }}>
                  <CheckboxField id="terms" checked={agreedTerms} onChange={setAgreedTerms}>
                    I agree to the{" "}
                    <a href="#" style={{ color:"var(--g800)", textDecoration:"underline" }} onClick={e => e.preventDefault()}>Terms</a>
                    {" "}and{" "}
                    <a href="#" style={{ color:"var(--g800)", textDecoration:"underline" }} onClick={e => e.preventDefault()}>Privacy Policy</a>
                  </CheckboxField>
                </div>

                <PrimaryButton type="submit">Create free account</PrimaryButton>
              </form>
            </div>

            {/* Card footer */}
            <div style={{ padding:"14px 28px", borderTop:"1px solid var(--bdr2)", textAlign:"center" }}>
              <p style={{ fontSize:13, color:"var(--txt3)" }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchTab("login")}
                  style={{ background:"none", border:"none", color:"var(--g800)", fontWeight:600, cursor:"pointer", fontSize:13 }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        ) : (
          /* ══════════ LOGIN CARD ══════════ */
          <div style={cardStyle}>
            {/* Card header */}
            <div style={{ padding:"28px 28px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, borderBottom:"1px solid var(--bdr2)" }}>
              <FarmSafeLogo />
              <div style={{ textAlign:"center" }}>
                <h2 style={{ fontFamily:"Lora,serif", fontSize:22, fontWeight:700, color:"var(--g900)", margin:0 }}>
                  Welcome back
                </h2>
                <p style={{ fontSize:13, color:"var(--txt3)", marginTop:4 }}>
                  Sign in to access your SOPs and reports.
                </p>
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding:"24px 28px" }}>
              {error && (
                <div style={{ padding:"10px 14px", background:"var(--red-l)", border:"1.5px solid #fca5a5", borderRadius:8, fontSize:13, color:"var(--red)", marginBottom:16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleLogin}>
                <Field
                  label="Email address"
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={setLoginEmail}
                  placeholder="you@example.com"
                  required
                />
                <PasswordField
                  label="Password"
                  id="login-password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  placeholder="Enter your password"
                  required
                />
                <div style={{ marginBottom:20 }} />
                <PrimaryButton type="submit">Sign in</PrimaryButton>
              </form>
            </div>

            {/* Card footer */}
            <div style={{ padding:"14px 28px", borderTop:"1px solid var(--bdr2)", textAlign:"center" }}>
              <p style={{ fontSize:13, color:"var(--txt3)" }}>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchTab("register")}
                  style={{ background:"none", border:"none", color:"var(--g800)", fontWeight:600, cursor:"pointer", fontSize:13 }}
                >
                  Create one
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── full-width primary button ─── */
function PrimaryButton({ children, type = "button", onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        height: 40,
        background: hovered ? "var(--g800)" : "var(--g900)",
        color: "white",
        border: "none",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
