import { useMemo, useState } from "react";
import { loadFromStorage, saveToStorage } from "../utils/storage.js";
import { getRecordItemSuggestion } from "../utils/api.js";
import { downloadRecordAsDocx } from "../utils/export.js";

const RECORDS_KEY = "sop_activity_records";

function toText(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildChecklistItems(sop, formData) {
  const items = [];
  sop.sections.forEach((section) => {
    if (section.id === "meta") return;
    section.fields.forEach((field) => {
      const val = formData[field.id];
      const textVal = toText(val).trim();
      const hasValue = Array.isArray(val) ? val.length > 0 : !!textVal;
      if (!field.required && !hasValue) return;

      items.push({
        id: `${section.id}-${field.id}`,
        sectionTitle: section.title,
        label: field.label,
        expected: hasValue ? textVal : "Define and verify according to SOP requirements.",
        status: "pending",
        notes: "",
      });
    });
  });

  items.push({
    id: `log-${sop.id}`,
    sectionTitle: "Records",
    label: `Complete and archive "${sop.log.title}"`,
    expected: `Document activity using log columns: ${sop.log.cols.join(", ")}`,
    status: "pending",
    notes: "",
  });

  return items;
}

function buildRecord(sop, formData, farmProfile) {
  const now = new Date();
  return {
    id: `${sop.id}-${now.getTime()}`,
    sopId: sop.id,
    sopTitle: sop.title,
    createdAt: now.toISOString(),
    activityDate: now.toISOString().slice(0, 10),
    farmName: farmProfile?.farm_name || "",
    performedBy: farmProfile?.food_safety_manager || farmProfile?.owner_name || "",
    verifiedBy: farmProfile?.farm_director || "",
    notes: "",
    items: buildChecklistItems(sop, formData),
  };
}

export default function SOPRecordModal({ sop, formData, farmProfile, onClose }) {
  const [allRecords, setAllRecords] = useState(() => loadFromStorage(RECORDS_KEY, []));
  const [activeId, setActiveId] = useState(null);
  const [aiLoadingItemId, setAiLoadingItemId] = useState(null);
  const [aiError, setAiError] = useState("");

  const records = useMemo(
    () => allRecords.filter((r) => r.sopId === sop.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allRecords, sop.id]
  );
  const activeRecord = records.find((r) => r.id === activeId) || records[0] || null;

  const persist = (updatedAll) => {
    setAllRecords(updatedAll);
    saveToStorage(RECORDS_KEY, updatedAll);
  };

  const createRecord = () => {
    const record = buildRecord(sop, formData, farmProfile);
    const updated = [record, ...allRecords];
    persist(updated);
    setActiveId(record.id);
  };

  const updateActive = (patch) => {
    if (!activeRecord) return;
    const updated = allRecords.map((r) => (r.id === activeRecord.id ? { ...r, ...patch } : r));
    persist(updated);
  };

  const updateItem = (itemId, patch) => {
    if (!activeRecord) return;
    const updated = allRecords.map((r) => {
      if (r.id !== activeRecord.id) return r;
      return {
        ...r,
        items: r.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    });
    persist(updated);
  };

  const deleteActive = () => {
    if (!activeRecord) return;
    const updated = allRecords.filter((r) => r.id !== activeRecord.id);
    persist(updated);
    setActiveId(null);
  };

  const handleAISuggest = async (item) => {
    if (!activeRecord || aiLoadingItemId) return;
    setAiError("");
    setAiLoadingItemId(item.id);
    try {
      const suggestion = await getRecordItemSuggestion(item, sop, formData, farmProfile, {
        activityDate: activeRecord.activityDate,
        performedBy: activeRecord.performedBy,
        verifiedBy: activeRecord.verifiedBy,
        notes: activeRecord.notes,
      });
      if (suggestion) {
        updateItem(item.id, { notes: suggestion });
      }
    } catch (e) {
      setAiError(e.message || "AI suggestion failed.");
    }
    setAiLoadingItemId(null);
  };

  const completion = activeRecord
    ? Math.round((activeRecord.items.filter((item) => item.status === "done").length / activeRecord.items.length) * 100)
    : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,17,34,.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "var(--cream)", borderRadius: 18, width: "min(1120px,96vw)", maxHeight: "90vh", boxShadow: "0 28px 60px rgba(0,26,49,.35)", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid rgba(255,255,255,.5)" }}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid rgba(255,255,255,.2)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(100deg,var(--u-navy-d),var(--u-navy-l))" }}>
          <div>
            <h2 style={{ fontFamily: "Lora,serif", fontSize: 22, color: "white" }}>Records Generator</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.78)", marginTop: 4 }}>
              Generate activity records and cross-check completion against "{sop.short}" SOP requirements.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", fontSize: 20, cursor: "pointer", color: "white", width: 36, height: 36, borderRadius: 10 }}>✕</button>
        </div>

        <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
          <div style={{ width: 320, borderRight: "1px solid var(--bdr2)", background: "linear-gradient(180deg,#ffffff,#f8fbff)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid var(--bdr2)" }}>
              <button onClick={createRecord} style={{ width: "100%", padding: "11px 14px", background: "linear-gradient(120deg,var(--u-sky),var(--u-navy-l))", color: "white", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 16px rgba(0,69,128,.25)" }}>
                + Generate Checklist Record
              </button>
            </div>
            <div style={{ padding: "14px 14px 10px", fontSize: 11, color: "var(--txt3)", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Existing Records
            </div>
            <div style={{ overflowY: "auto", padding: "0 10px 12px" }}>
              {records.length === 0 ? (
                <div style={{ padding: 12, color: "var(--txt3)", fontSize: 12, lineHeight: 1.5 }}>
                  No records yet. Generate your first checklist record to document SOP actions.
                </div>
              ) : (
                records.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => setActiveId(record.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      marginBottom: 8,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: activeRecord?.id === record.id ? "1.5px solid var(--u-navy)" : "1px solid var(--bdr2)",
                      background: activeRecord?.id === record.id ? "linear-gradient(180deg,var(--sky-l),#dbeafe)" : "white",
                      cursor: "pointer",
                      boxShadow: activeRecord?.id === record.id ? "0 8px 14px rgba(0,69,128,.12)" : "none",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>{record.activityDate}</div>
                    <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>
                      {record.performedBy || "No assignee"} • {record.items.length} checks
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {!activeRecord ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--txt3)", fontSize: 14, padding: 24 }}>
                Generate or select a record to document SOP activity.
              </div>
            ) : (
              <>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--bdr2)", background: "linear-gradient(180deg,#ffffff,#f8fbff)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "var(--txt2)" }}>
                      Activity Date
                      <input
                        type="date"
                        value={activeRecord.activityDate || ""}
                        onChange={(e) => updateActive({ activityDate: e.target.value })}
                        style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 13 }}
                      />
                    </label>
                    <label style={{ fontSize: 12, color: "var(--txt2)" }}>
                      Performed By
                      <input
                        value={activeRecord.performedBy || ""}
                        onChange={(e) => updateActive({ performedBy: e.target.value })}
                        style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 13 }}
                      />
                    </label>
                    <label style={{ fontSize: 12, color: "var(--txt2)" }}>
                      Verified By
                      <input
                        value={activeRecord.verifiedBy || ""}
                        onChange={(e) => updateActive({ verifiedBy: e.target.value })}
                        style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 13 }}
                      />
                    </label>
                    <div style={{ fontSize: 12, color: "var(--txt2)", background: "white", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "8px 10px" }}>
                      Completion
                      <div style={{ marginTop: 8 }}>
                        <div style={{ width: "100%", height: 10, borderRadius: 999, background: "var(--cream2)", overflow: "hidden", border: "1px solid var(--bdr)" }}>
                          <div style={{ height: "100%", width: `${completion}%`, background: "linear-gradient(90deg,var(--u-sky),var(--u-navy-l))", transition: "width .25s ease" }} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--u-navy)", marginTop: 6, fontWeight: 700 }}>{completion}% done</div>
                      </div>
                    </div>
                  </div>
                  <label style={{ fontSize: 12, color: "var(--txt2)", display: "block" }}>
                    Record Notes
                    <textarea
                      value={activeRecord.notes || ""}
                      onChange={(e) => updateActive({ notes: e.target.value })}
                      rows={2}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 13, resize: "vertical" }}
                      placeholder="General observations, deviations, or corrective actions."
                    />
                  </label>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                  {aiError && (
                    <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "var(--red-l)", borderRadius: 8, fontSize: 12, color: "var(--red)" }}>
                      {aiError}
                    </div>
                  )}
                  {activeRecord.items.map((item) => (
                    <div key={item.id} style={{ marginBottom: 10, background: "white", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12, boxShadow: "0 3px 10px rgba(2,6,23,.05)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--txt3)", marginBottom: 4 }}>
                        {item.sectionTitle}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)", marginBottom: 8 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.5, marginBottom: 10 }}>
                        <strong>Expected:</strong> {item.expected}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 110px", gap: 10 }}>
                        <select
                          value={item.status}
                          onChange={(e) => updateItem(item.id, { status: e.target.value })}
                          style={{
                            padding: "8px 10px",
                            border: "1px solid var(--bdr)",
                            borderRadius: 8,
                            fontSize: 13,
                            background:
                              item.status === "done"
                                ? "#ecfdf3"
                                : item.status === "needs-action"
                                  ? "#fff1f2"
                                  : item.status === "not-applicable"
                                    ? "#f8fafc"
                                    : "white",
                            color:
                              item.status === "done"
                                ? "#166534"
                                : item.status === "needs-action"
                                  ? "#b91c1c"
                                  : "var(--txt)",
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="done">Completed</option>
                          <option value="not-applicable">Not Applicable</option>
                          <option value="needs-action">Needs Corrective Action</option>
                        </select>
                        <input
                          value={item.notes || ""}
                          onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                          placeholder="Evidence / notes (who, when, where, deviation details)"
                          style={{ padding: "8px 10px", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 13 }}
                        />
                        <button
                          onClick={() => handleAISuggest(item)}
                          disabled={aiLoadingItemId === item.id}
                          style={{
                            padding: "8px 10px",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            color: "white",
                            cursor: aiLoadingItemId === item.id ? "wait" : "pointer",
                            background: aiLoadingItemId === item.id ? "var(--g700)" : "linear-gradient(120deg,var(--u-sky),var(--u-navy-l))",
                          }}
                        >
                          {aiLoadingItemId === item.id ? "Thinking..." : "AI Suggest"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid var(--bdr2)", padding: 14, display: "flex", justifyContent: "space-between", background: "white" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => downloadRecordAsDocx(sop, activeRecord, farmProfile)}
                      style={{ padding: "9px 14px", border: "none", borderRadius: 8, background: "linear-gradient(120deg,var(--u-sky),var(--u-navy-l))", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                    >
                      Download Record
                    </button>
                    <button
                      onClick={deleteActive}
                      style={{ padding: "9px 14px", border: "1px solid #fca5a5", borderRadius: 8, background: "var(--red-l)", color: "var(--red)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    >
                      Delete Record
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--txt3)", alignSelf: "center" }}>
                    Saved automatically to local storage.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
