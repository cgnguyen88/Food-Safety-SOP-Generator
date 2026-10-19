import { useLanguage } from "../i18n/LanguageContext.jsx";

const TEXT = {
  en: {
    loading: "Loading your farm…",
    retry: "Try again",
    signOut: "Sign out",
    close: "Close",
    saving: "Saving…",
    retrySave: "Retry",
    kinds: { farm_profile: "farm profile", incidents: "incident log", cost_settings: "cost settings", sop_activity_records: "SOP activity records" },
    copied: (list) => `We copied the ${list} saved in this browser into your farm account, so your team sees it on every device.`,
    kept: (list) => `Your account already had ${list}, so that was kept; this browser's copy is saved as a backup for 30 days.`,
    failed: (list) => `The ${list} saved in this browser could not be copied into your account. It stays in this browser, and you will be asked again next time you sign in.`,
    offerTitle: "Data saved in this browser",
    offer: (list, farm) => `This browser holds ${list} saved before accounts existed. Copy it into ${farm}? Only do this if it belongs to this farm.`,
    offerOwner: (email) => `It was saved by ${email}.`,
    copyInto: (farm) => `Copy into ${farm}`,
    notNow: "Not now",
    merged: "Changes made on another device were combined with yours.",
  },
  es: {
    loading: "Cargando su granja…",
    retry: "Intentar de nuevo",
    signOut: "Cerrar sesión",
    close: "Cerrar",
    saving: "Guardando…",
    retrySave: "Reintentar",
    kinds: { farm_profile: "perfil de la granja", incidents: "registro de incidentes", cost_settings: "configuración de costos", sop_activity_records: "registros de actividades de POE" },
    copied: (list) => `Copiamos ${list} guardado en este navegador a la cuenta de su granja, para que su equipo lo vea en todos los dispositivos.`,
    kept: (list) => `Su cuenta ya tenía ${list}, así que se conservó; la copia de este navegador se guarda como respaldo durante 30 días.`,
    failed: (list) => `No se pudo copiar ${list} de este navegador a su cuenta. Se queda en este navegador y se le preguntará de nuevo la próxima vez que inicie sesión.`,
    offerTitle: "Datos guardados en este navegador",
    offer: (list, farm) => `Este navegador tiene ${list} guardado antes de que existieran las cuentas. ¿Copiarlo a ${farm}? Hágalo solo si pertenece a esta granja.`,
    offerOwner: (email) => `Lo guardó ${email}.`,
    copyInto: (farm) => `Copiar a ${farm}`,
    notNow: "Ahora no",
    merged: "Los cambios hechos en otro dispositivo se combinaron con los suyos.",
  },
};

const useText = () => {
  const { lang } = useLanguage();
  return TEXT[lang === "es" ? "es" : "en"];
};

const listOf = (keys, kinds) => keys.map((key) => kinds[key] ?? key).join(", ");

const buttonStyle = {
  padding: "8px 16px", borderRadius: 8, border: "1.5px solid var(--bdr)", background: "white",
  color: "var(--u-navy)", fontWeight: 600, cursor: "pointer", fontSize: 14,
};

/** The whole-screen message while the farm loads, or when it could not be loaded. */
export function AccountMessage({ kind, message, onRetry, onSignOut }) {
  const tx = useText();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)", padding: 24 }}>
      {kind === "loading" ? (
        <p role="status" style={{ color: "var(--txt2)", fontSize: 16 }}>{tx.loading}</p>
      ) : (
        <div style={{ maxWidth: 440, background: "white", borderRadius: 14, padding: 28, boxShadow: "var(--shadow)", textAlign: "center" }}>
          <p role="alert" style={{ color: "var(--red)", fontSize: 15, marginBottom: 20 }}>{message}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button type="button" onClick={onRetry} style={{ ...buttonStyle, background: "var(--u-navy)", color: "white", border: "none" }}>{tx.retry}</button>
            <button type="button" onClick={onSignOut} style={buttonStyle}>{tx.signOut}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What the first sign-in did with the data this browser kept before accounts existed. */
export function ImportNotice({ result, onDismiss }) {
  const tx = useText();
  const { imported, kept, failed } = result;
  if (imported.length === 0 && kept.length === 0 && failed.length === 0) return null;
  const warning = failed.length > 0;
  return (
    <div
      role={warning ? "alert" : "status"}
      className="no-print"
      style={{
        display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between",
        padding: "12px 20px", fontSize: 14, lineHeight: 1.5,
        background: warning ? "var(--red-l)" : "#ecfdf5",
        color: warning ? "var(--red)" : "#065f46",
        borderBottom: `1px solid ${warning ? "#fca5a5" : "#6ee7b7"}`,
      }}
    >
      <div>
        {imported.length > 0 && <p>{tx.copied(listOf(imported, tx.kinds))}</p>}
        {kept.length > 0 && <p>{tx.kept(listOf(kept, tx.kinds))}</p>}
        {warning && <p>{tx.failed(listOf(failed, tx.kinds))}</p>}
      </div>
      <button type="button" onClick={onDismiss} aria-label={tx.close} style={{ background: "none", border: "none", color: "inherit", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
    </div>
  );
}

/** Offers to copy what this browser kept before accounts existed into the farm. Nothing is copied unless asked. */
export function ImportOffer({ offer, farmName, onAccept, onDecline }) {
  const tx = useText();
  if (!offer) return null;
  const parts = Object.entries(offer.values).map(([key, value]) => {
    const name = tx.kinds[key] ?? key;
    return Array.isArray(value) ? `${name} (${value.length})` : name;
  });
  const farm = farmName || "your farm";
  return (
    <section
      aria-label={tx.offerTitle}
      className="no-print"
      style={{ padding: "14px 20px", background: "#eff6ff", color: "var(--u-navy)", borderBottom: "1px solid #bfdbfe", fontSize: 14, lineHeight: 1.5 }}
    >
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{tx.offerTitle}</p>
      <p>{tx.offer(parts.join(", "), farm)}{offer.owner ? ` ${tx.offerOwner(offer.owner)}` : ""}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={onAccept} style={{ ...buttonStyle, background: "var(--u-navy)", color: "white", border: "none" }}>{tx.copyInto(farm)}</button>
        <button type="button" onClick={onDecline} style={buttonStyle}>{tx.notNow}</button>
      </div>
    </section>
  );
}

/** Says that a save was combined with changes another device made at the same time. */
export function MergedNotice({ show, onDismiss }) {
  const tx = useText();
  if (!show) return null;
  return (
    <div role="status" className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 20px", background: "#fffbeb", color: "#92400e", borderBottom: "1px solid #fcd34d", fontSize: 14 }}>
      <span>{tx.merged}</span>
      <button type="button" onClick={onDismiss} aria-label={tx.close} style={{ background: "none", border: "none", color: "inherit", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
    </div>
  );
}

/** A small note in the corner while changes are saved, and when a save failed. */
export function SaveIndicator({ status, onRetry }) {
  const tx = useText();
  if (status.state === "saved") return null;
  const failed = status.state === "error";
  return (
    <div
      role={failed ? "alert" : "status"}
      className="no-print"
      style={{
        position: "fixed", left: 16, bottom: 16, zIndex: 900, maxWidth: 360,
        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13,
        background: failed ? "var(--red-l)" : "white", color: failed ? "var(--red)" : "var(--txt2)",
        border: `1px solid ${failed ? "#fca5a5" : "var(--bdr)"}`, boxShadow: "var(--shadow)",
      }}
    >
      <span>{failed ? status.error : tx.saving}</span>
      {failed && <button type="button" onClick={onRetry} style={{ ...buttonStyle, padding: "4px 10px", fontSize: 13 }}>{tx.retrySave}</button>}
    </div>
  );
}
