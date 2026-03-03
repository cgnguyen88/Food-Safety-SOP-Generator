import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { T } from "../i18n/translations.js";
import { SOP_DATA } from "../data/sop-data.js";
import { getLocalizedSop } from "../i18n/sop-translations.js";
import { callClaudeStreaming } from "../utils/api.js";
import { Sparkles, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType } from "docx";
import { saveAs } from "file-saver";

export default function PlanGenerator({ farmProfile, onBack }) {
    const { lang } = useLanguage();
    const s = T[lang].planGenerator;

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        fsmName: farmProfile?.food_safety_manager || "",
        fsmRole: "",
        riskWater: "yes",
        riskAnimals: "no",
        riskHygiene: "yes",
        riskSoil: "no",
        selectedSops: [],
        lotCodeSystem: "",
        mockRecall: "",
        practices: "",
        policies: "",
        emergencyContact: "",
        supplierInfo: "",
        servicesInfo: ""
    });

    const [isGeneratingLot, setIsGeneratingLot] = useState(false);
    const [isGeneratingRecall, setIsGeneratingRecall] = useState(false);
    const [isGeneratingPractices, setIsGeneratingPractices] = useState(false);
    const [isGeneratingPolicies, setIsGeneratingPolicies] = useState(false);
    const [isGeneratingEmergency, setIsGeneratingEmergency] = useState(false);
    const [isGeneratingSupplier, setIsGeneratingSupplier] = useState(false);
    const [isGeneratingServices, setIsGeneratingServices] = useState(false);

    const localizedSops = SOP_DATA.map(sop => getLocalizedSop(sop, lang));

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleSop = (id) => {
        setFormData(prev => {
            const isSelected = prev.selectedSops.includes(id);
            if (isSelected) {
                return { ...prev, selectedSops: prev.selectedSops.filter(s => s !== id) };
            } else {
                return { ...prev, selectedSops: [...prev.selectedSops, id] };
            }
        });
    };

    const nextStep = () => {
        if (step < 6) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleDownloadWord = async () => {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 20, color: "005baa" },
                            bottom: { style: BorderStyle.SINGLE, size: 20, color: "005baa" },
                            left: { style: BorderStyle.NIL },
                            right: { style: BorderStyle.NIL },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 10, color: "005baa" },
                            insideVertical: { style: BorderStyle.NIL },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        shading: { type: ShadingType.CLEAR, fill: "F0F8FF" },
                                        padding: { top: 200, bottom: 200, left: 200, right: 200 },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: farmProfile?.farm_name || "Farm Name", bold: true, size: 36, color: "001A31" })
                                                ],
                                                spacing: { after: 100 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: "Farm Food Safety Plan", bold: true, size: 32, color: "005baa" })
                                                ],
                                                spacing: { after: 100 }
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({
                                        shading: { type: ShadingType.CLEAR, fill: "F9FAFB" },
                                        padding: { top: 200, bottom: 200, left: 200, right: 200 },
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: "Farm Name: ", bold: true }),
                                                    new TextRun(farmProfile?.farm_name || "N/A"),
                                                    new TextRun({ text: " | ", color: "888888" }),
                                                    new TextRun({ text: "Address: ", bold: true }),
                                                    new TextRun(farmProfile?.address || "N/A")
                                                ],
                                                spacing: { after: 100 }
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({ text: "Owner: ", bold: true }),
                                                    new TextRun(farmProfile?.owner_name || "N/A"),
                                                    new TextRun({ text: " | ", color: "888888" }),
                                                    new TextRun({ text: "Food Safety Manager: ", bold: true }),
                                                    new TextRun(`${formData.fsmName} (${formData.fsmRole})`)
                                                ]
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({ spacing: { before: 400 } }), // Spacer
                    new Paragraph({
                        text: "2. Risk Assessment Summary",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    ...[
                        { id: "riskWater", label: s.riskWater },
                        { id: "riskAnimals", label: s.riskAnimals },
                        { id: "riskHygiene", label: s.riskHygiene },
                        { id: "riskSoil", label: s.riskSoil }
                    ].map(risk => new Paragraph({
                        children: [
                            new TextRun({ text: risk.label + ": ", bold: true }),
                            new TextRun({ text: (formData[risk.id] || "N/A").toUpperCase(), color: formData[risk.id] === 'yes' ? "D32F2F" : "000000" })
                        ],
                        spacing: { before: 100 }
                    })),
                    new Paragraph({
                        text: "3. Standard Operating Procedures (SOPs)",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    ...(formData.selectedSops.length > 0
                        ? formData.selectedSops.map(id => {
                            const sop = localizedSops.find(s => s.id === id);
                            return new Paragraph({
                                text: `• ${sop?.short || "Unknown SOP"}`,
                                spacing: { before: 100 }
                            });
                        })
                        : [new Paragraph({ text: "No SOPs selected.", italics: true })]
                    ),
                    new Paragraph({
                        text: "4. Traceability System",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    new Paragraph({
                        text: "Lot Coding System",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 }
                    }),
                    ...(formData.lotCodeSystem ? formData.lotCodeSystem.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),
                    new Paragraph({
                        text: "Mock Recall Procedure",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 }
                    }),
                    ...(formData.mockRecall ? formData.mockRecall.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),
                    new Paragraph({
                        text: "5. Additional Policies & Contacts",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    new Paragraph({ text: s.practicesLabel, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
                    ...(formData.practices ? formData.practices.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),
                    new Paragraph({ text: s.policiesLabel, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
                    ...(formData.policies ? formData.policies.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),
                    new Paragraph({ text: s.emergencyContactLabel, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
                    ...(formData.emergencyContact ? formData.emergencyContact.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),
                    new Paragraph({ text: s.supplierLabel, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
                    ...(formData.supplierInfo ? formData.supplierInfo.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),
                    new Paragraph({ text: s.servicesLabel, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
                    ...(formData.servicesInfo ? formData.servicesInfo.split('\n').map(line => new Paragraph({ text: line })) : [new Paragraph({ text: "Not specified.", italics: true })]),

                    new Paragraph({
                        text: "6. Required Attachments",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    new Paragraph({ text: `[ ] ${s.recordsPracticesLabel}`, spacing: { before: 100 } }),
                    new Paragraph({ text: `[ ] ${s.farmMapsLabel}`, spacing: { before: 100 } }),
                    new Paragraph({ text: `[ ] ${s.trainingRecordsLabel}`, spacing: { before: 100 } }),
                    new Paragraph({ text: `[ ] ${s.waterTestLabel}`, spacing: { before: 100 } }),
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, "Farm-Food-Safety-Plan.docx");
    };

    const generateSuggestion = async (type) => {
        let setGenerating, promptSnippet, fieldName;

        switch (type) {
            case 'lot':
                setGenerating = setIsGeneratingLot;
                promptSnippet = `generate a concise, practical, and compliant example of a "Lot Code System" for traceability. A lot code should typically include the farm name/location, the specific field/block harvested from, and the date of harvest. Keep it to 1-2 short paragraphs explaining the system format and giving one practical example.`;
                fieldName = "lotCodeSystem";
                break;
            case 'recall':
                setGenerating = setIsGeneratingRecall;
                promptSnippet = `generate a concise, practical, and compliant "Mock Recall Procedure". The procedure should outline 3-4 bullet points on how to conduct a dummy recall (tracing one lot forward to the buyer and backward to the field within 2 hours). Keep it brief, action-oriented, and easy to understand.`;
                fieldName = "mockRecall";
                break;
            case 'practices':
                setGenerating = setIsGeneratingPractices;
                promptSnippet = `generate a concise list of 4-5 "Practices to reduce food safety risks". These should be practical, everyday actions farm workers take (e.g., handwashing, tool sanitizing, looking for animal signs, keeping harvested crops off ground). Keep it brief and action-oriented.`;
                fieldName = "practices";
                break;
            case 'policies':
                setGenerating = setIsGeneratingPolicies;
                promptSnippet = `generate a concise, practical "Farm Food Safety Policy" statement. This should be 1-2 paragraphs declaring the farm's commitment to producing safe food, following FSMA Produce Safety Rule regulations, and empowering workers to report safety concerns.`;
                fieldName = "policies";
                break;
            case 'emergencyContact':
                setGenerating = setIsGeneratingEmergency;
                promptSnippet = `generate a template for "Emergency contact information" for a farm. It should include placeholders for Local Police/Fire/Medical (911), Poison Control, the Farm Owner, Food Safety Manager, and the State Agriculture Department. Format it clearly as a list.`;
                fieldName = "emergencyContact";
                break;
            case 'supplierInfo':
                setGenerating = setIsGeneratingSupplier;
                promptSnippet = `generate a template for "Supplier and buyer information" for an agricultural operation. Include fields/placeholders for primary packaging suppliers, fertilizer/amendment suppliers, and primary wholesale buyers/distributors. Format it clearly with bullet points.`;
                fieldName = "supplierInfo";
                break;
            case 'servicesInfo':
                setGenerating = setIsGeneratingServices;
                promptSnippet = `generate a template for "Contact info for contracted services". Include placeholders for common farm contracted services such as pest control, port-a-john/sanitation services, chemical applicators, and third-party auditors. Format it clearly as a list.`;
                fieldName = "servicesInfo";
                break;
            default:
                return;
        }

        setGenerating(true);
        try {
            const systemPrompt = "You are an expert in FSMA Produce Safety Rule compliance. The user is a farmer creating their Farm Food Safety Plan.";
            const userPrompt = `Based on my farm profile (Name: ${farmProfile?.farm_name || 'N/A'}, Crops: ${farmProfile?.crops || 'N/A'}, Operation Type: ${farmProfile?.operation_type || 'N/A'}), ${promptSnippet} Return ONLY the suggested text.`;

            const messages = [{ role: "user", content: userPrompt }];

            let fullText = "";

            await callClaudeStreaming(messages, systemPrompt, (chunk) => {
                fullText += chunk;
                handleChange(fieldName, fullText);
            });

            if (!fullText) {
                const errorMsg = "Could not generate suggestion. Please add your API key in settings or try again later.";
                handleChange(fieldName, errorMsg);
            }
        } catch (error) {
            console.error("Error generating suggestion:", error);
            const errorMsg = "An error occurred while generating the suggestion. Please try again.";
            handleChange(fieldName, errorMsg);
        } finally {
            setGenerating(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <p>{s.step1Desc}</p>
                        <div style={{ background: "var(--cream)", padding: "20px", borderRadius: "12px", border: "1px solid var(--bdr)" }}>
                            <h3 style={{ marginBottom: "12px", color: "var(--u-navy)" }}>{s.farmSummary}</h3>
                            <p><strong>{T[lang].farmProfile.fields.farm_name}:</strong> {farmProfile?.farm_name || "N/A"}</p>
                            <p><strong>{T[lang].farmProfile.fields.address}:</strong> {farmProfile?.address || "N/A"}</p>
                            <p><strong>{T[lang].farmProfile.fields.operation_type}:</strong> {farmProfile?.operation_type || "N/A"}</p>
                            <p><strong>{T[lang].farmProfile.fields.crops}:</strong> {farmProfile?.crops || "N/A"}</p>
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{s.fsmName}</label>
                            <input
                                type="text"
                                value={formData.fsmName}
                                onChange={(e) => handleChange("fsmName", e.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--bdr)" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{s.fsmRole}</label>
                            <input
                                type="text"
                                value={formData.fsmRole}
                                onChange={(e) => handleChange("fsmRole", e.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--bdr)" }}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <p>{s.step2Desc}</p>
                        {[
                            { id: "riskWater", label: s.riskWater },
                            { id: "riskAnimals", label: s.riskAnimals },
                            { id: "riskHygiene", label: s.riskHygiene },
                            { id: "riskSoil", label: s.riskSoil }
                        ].map(risk => (
                            <div key={risk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "16px", borderRadius: "8px", border: "1px solid var(--bdr)" }}>
                                <span style={{ fontWeight: 500 }}>{risk.label}</span>
                                <select
                                    value={formData[risk.id]}
                                    onChange={(e) => handleChange(risk.id, e.target.value)}
                                    style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--bdr)" }}
                                >
                                    <option value="yes">{lang === 'en' ? 'Yes' : 'Sí'}</option>
                                    <option value="no">No</option>
                                    <option value="n/a">N/A</option>
                                </select>
                            </div>
                        ))}
                    </div>
                );
            case 3:
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <p>{s.step3Desc}</p>
                        <p style={{ fontWeight: 600 }}>{s.selectSops}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            {localizedSops.map(sop => (
                                <button
                                    key={sop.id}
                                    onClick={() => toggleSop(sop.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px",
                                        padding: "16px", borderRadius: "10px",
                                        border: formData.selectedSops.includes(sop.id) ? "2px solid var(--u-gold)" : "1px solid var(--bdr)",
                                        background: formData.selectedSops.includes(sop.id) ? "rgba(253,189,16,0.1)" : "white",
                                        cursor: "pointer", textAlign: "left", transition: "all 0.2s"
                                    }}
                                >
                                    <span style={{ fontSize: "24px" }}>{sop.icon}</span>
                                    <span style={{ fontWeight: 600, color: "var(--u-navy)", lineHeight: 1.3 }}>{sop.short}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <p>{s.step4Desc}</p>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.lotCodeSystem}</label>
                                <button
                                    onClick={() => generateSuggestion('lot')}
                                    disabled={isGeneratingLot}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        background: "var(--u-gold)", color: "var(--u-navy-d)",
                                        border: "none", borderRadius: "14px", padding: "6px 12px",
                                        fontSize: "12px", fontWeight: 700, cursor: isGeneratingLot ? "not-allowed" : "pointer",
                                        opacity: isGeneratingLot ? 0.7 : 1
                                    }}
                                >
                                    <Sparkles size={14} />
                                    {isGeneratingLot ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea
                                rows="4"
                                value={formData.lotCodeSystem}
                                onChange={(e) => handleChange("lotCodeSystem", e.target.value)}
                                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }}
                            />
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.mockRecall}</label>
                                <button
                                    onClick={() => generateSuggestion('recall')}
                                    disabled={isGeneratingRecall}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        background: "var(--u-gold)", color: "var(--u-navy-d)",
                                        border: "none", borderRadius: "14px", padding: "6px 12px",
                                        fontSize: "12px", fontWeight: 700, cursor: isGeneratingRecall ? "not-allowed" : "pointer",
                                        opacity: isGeneratingRecall ? 0.7 : 1
                                    }}
                                >
                                    <Sparkles size={14} />
                                    {isGeneratingRecall ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea
                                rows="4"
                                value={formData.mockRecall}
                                onChange={(e) => handleChange("mockRecall", e.target.value)}
                                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }}
                            />
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <p>{s.step5Desc}</p>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.practicesLabel}</label>
                                <button onClick={() => generateSuggestion('practices')} disabled={isGeneratingPractices} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: "14px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: isGeneratingPractices ? "not-allowed" : "pointer", opacity: isGeneratingPractices ? 0.7 : 1 }}>
                                    <Sparkles size={14} /> {isGeneratingPractices ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea rows="3" value={formData.practices} onChange={(e) => handleChange("practices", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }} />
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.policiesLabel}</label>
                                <button onClick={() => generateSuggestion('policies')} disabled={isGeneratingPolicies} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: "14px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: isGeneratingPolicies ? "not-allowed" : "pointer", opacity: isGeneratingPolicies ? 0.7 : 1 }}>
                                    <Sparkles size={14} /> {isGeneratingPolicies ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea rows="3" value={formData.policies} onChange={(e) => handleChange("policies", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }} />
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.emergencyContactLabel}</label>
                                <button onClick={() => generateSuggestion('emergencyContact')} disabled={isGeneratingEmergency} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: "14px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: isGeneratingEmergency ? "not-allowed" : "pointer", opacity: isGeneratingEmergency ? 0.7 : 1 }}>
                                    <Sparkles size={14} /> {isGeneratingEmergency ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea rows="3" value={formData.emergencyContact} onChange={(e) => handleChange("emergencyContact", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }} />
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.supplierLabel}</label>
                                <button onClick={() => generateSuggestion('supplierInfo')} disabled={isGeneratingSupplier} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: "14px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: isGeneratingSupplier ? "not-allowed" : "pointer", opacity: isGeneratingSupplier ? 0.7 : 1 }}>
                                    <Sparkles size={14} /> {isGeneratingSupplier ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea rows="3" value={formData.supplierInfo} onChange={(e) => handleChange("supplierInfo", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }} />
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontWeight: 600 }}>{s.servicesLabel}</label>
                                <button onClick={() => generateSuggestion('servicesInfo')} disabled={isGeneratingServices} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--u-gold)", color: "var(--u-navy-d)", border: "none", borderRadius: "14px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: isGeneratingServices ? "not-allowed" : "pointer", opacity: isGeneratingServices ? 0.7 : 1 }}>
                                    <Sparkles size={14} /> {isGeneratingServices ? "Generating..." : "AI Suggestion"}
                                </button>
                            </div>
                            <textarea rows="3" value={formData.servicesInfo} onChange={(e) => handleChange("servicesInfo", e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--bdr)", resize: "vertical" }} />
                        </div>
                    </div>
                );
            case 6:
                return (
                    <div className="print-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div className="no-print" style={{ background: "var(--g100)", borderLeft: "4px solid var(--u-sky)", padding: "16px", borderRadius: "4px" }}>
                            <p>{s.planGenerated}</p>
                        </div>

                        <div style={{ background: "white", padding: "40px", borderRadius: "12px", border: "1px solid var(--bdr)", boxShadow: "var(--shadow)" }}>
                            <h1 style={{ color: "var(--u-navy)", textAlign: "center", marginBottom: "32px", borderBottom: "2px solid var(--u-gold)", paddingBottom: "16px" }}>Farm Food Safety Plan</h1>

                            <section style={{ marginBottom: "32px" }}>
                                <h2 style={{ color: "var(--u-navy-l)", marginBottom: "16px", fontSize: "20px" }}>1. Farm Information</h2>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <p><strong>Farm Name:</strong> {farmProfile?.farm_name || "N/A"}</p>
                                    <p><strong>Owner:</strong> {farmProfile?.owner_name || "N/A"}</p>
                                    <p><strong>Food Safety Manager:</strong> {formData.fsmName} ({formData.fsmRole})</p>
                                    <p><strong>Address:</strong> {farmProfile?.address || "N/A"}</p>
                                </div>
                            </section>

                            <section style={{ marginBottom: "32px" }}>
                                <h2 style={{ color: "var(--u-navy-l)", marginBottom: "16px", fontSize: "20px" }}>2. Risk Assessment Summary</h2>
                                <ul style={{ listStyleType: "none", padding: 0 }}>
                                    {[
                                        { id: "riskWater", label: s.riskWater },
                                        { id: "riskAnimals", label: s.riskAnimals },
                                        { id: "riskHygiene", label: s.riskHygiene },
                                        { id: "riskSoil", label: s.riskSoil }
                                    ].map(risk => (
                                        <li key={risk.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--bdr2)" }}>
                                            <strong>{risk.label}</strong>: <span style={{ textTransform: "uppercase", color: formData[risk.id] === 'yes' ? "var(--g700)" : "inherit" }}>{formData[risk.id]}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <section style={{ marginBottom: "32px" }}>
                                <h2 style={{ color: "var(--u-navy-l)", marginBottom: "16px", fontSize: "20px" }}>3. Standard Operating Procedures (SOPs)</h2>
                                {formData.selectedSops.length > 0 ? (
                                    <ul style={{ paddingLeft: "20px" }}>
                                        {formData.selectedSops.map(id => {
                                            const sop = localizedSops.find(s => s.id === id);
                                            return <li key={id} style={{ marginBottom: "8px" }}>{sop?.short}</li>
                                        })}
                                    </ul>
                                ) : (
                                    <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>No SOPs selected.</p>
                                )}
                            </section>

                            <section style={{ marginBottom: "32px" }}>
                                <h2 style={{ color: "var(--u-navy-l)", marginBottom: "16px", fontSize: "20px" }}>4. Traceability System</h2>
                                <div style={{ marginBottom: "16px" }}>
                                    <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Lot Coding System</h3>
                                    <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>
                                        {formData.lotCodeSystem ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.lotCodeSystem}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}
                                    </div>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Mock Recall Procedure</h3>
                                    <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>
                                        {formData.mockRecall ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.mockRecall}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}
                                    </div>
                                </div>
                            </section>
                            <section style={{ marginBottom: "32px" }}>
                                <h2 style={{ color: "var(--u-navy-l)", marginBottom: "16px", fontSize: "20px" }}>5. Additional Policies & Contacts</h2>
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div>
                                        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{s.practicesLabel}</h3>
                                        <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>{formData.practices ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.practices}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}</div>
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{s.policiesLabel}</h3>
                                        <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>{formData.policies ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.policies}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}</div>
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{s.emergencyContactLabel}</h3>
                                        <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>{formData.emergencyContact ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.emergencyContact}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}</div>
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{s.supplierLabel}</h3>
                                        <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>{formData.supplierInfo ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.supplierInfo}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}</div>
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{s.servicesLabel}</h3>
                                        <div style={{ background: "var(--cream)", padding: "16px", borderRadius: "8px" }}>{formData.servicesInfo ? <p style={{ whiteSpace: "pre-wrap" }}>{formData.servicesInfo}</p> : <p style={{ fontStyle: "italic", color: "var(--txt3)" }}>Not specified.</p>}</div>
                                    </div>
                                </div>
                            </section>

                            <section style={{ marginBottom: "32px" }}>
                                <h2 style={{ color: "var(--u-navy-l)", marginBottom: "16px", fontSize: "20px" }}>6. Required Attachments</h2>
                                <ul style={{ listStyleType: "none", padding: "0" }}>
                                    <li style={{ marginBottom: "8px" }}>[ ] {s.recordsPracticesLabel}</li>
                                    <li style={{ marginBottom: "8px" }}>[ ] {s.farmMapsLabel}</li>
                                    <li style={{ marginBottom: "8px" }}>[ ] {s.trainingRecordsLabel}</li>
                                    <li style={{ marginBottom: "8px" }}>[ ] {s.waterTestLabel}</li>
                                </ul>
                            </section>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{
            maxWidth: 900, margin: "auto", width: "100%", height: "100%",
            display: "flex", flexDirection: "column", padding: "32px 40px", background: "var(--cream)"
        }}>
            {/* Header */}
            <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
                <div>
                    <button
                        onClick={onBack}
                        style={{ marginBottom: "12px", background: "none", border: "none", color: "var(--u-sky)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        ← {s.back}
                    </button>
                    <h1 style={{ color: "var(--u-navy)", fontSize: "28px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "32px" }}>📋</span> {s.title}
                    </h1>
                    <p style={{ color: "var(--txt3)", marginTop: "8px", fontSize: "15px" }}>{s.subtitle}</p>
                </div>
            </div>

            {/* Progress Bar (No print) */}
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px", position: "relative" }}>
                <div style={{ position: "absolute", top: "14px", left: 0, right: 0, height: "3px", background: "var(--bdr2)", zIndex: 0 }}></div>
                <div style={{ position: "absolute", top: "14px", left: 0, width: `${(step - 1) * 20}%`, height: "3px", background: "var(--u-navy)", zIndex: 0, transition: "width 0.3s ease" }}></div>

                {[{ num: 1, label: s.step1 }, { num: 2, label: s.step2 }, { num: 3, label: s.step3 }, { num: 4, label: s.step4 }, { num: 5, label: s.step5 }, { num: 6, label: s.step6 }].map(st => (
                    <div key={st.num} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 1, cursor: "pointer" }} onClick={() => setStep(st.num)}>
                        <div style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            background: step >= st.num ? "var(--u-navy)" : "white",
                            color: step >= st.num ? "white" : "var(--txt3)",
                            border: step >= st.num ? "2px solid var(--u-navy)" : "2px solid var(--bdr)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                            transition: "all 0.3s ease"
                        }}>
                            {step > st.num ? "✓" : st.num}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: step >= st.num ? "var(--u-navy)" : "var(--txt3)", background: "var(--cream)", padding: "0 8px" }}>
                            {st.label.replace(/^\d+\.\s/, '')}
                        </span>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: "auto", background: step < 6 ? "white" : "transparent", padding: step < 6 ? "32px" : "0", borderRadius: "16px", boxShadow: step < 6 ? "var(--shadow)" : "none", marginBottom: "24px" }}>
                {renderStepContent()}
            </div>

            {/* Footer / Controls (No print) */}
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid var(--bdr2)" }}>
                {step > 1 ? (
                    <button
                        onClick={prevStep}
                        style={{ padding: "12px 24px", borderRadius: "8px", background: "white", border: "1px solid var(--bdr)", fontWeight: 600, color: "var(--txt2)", cursor: "pointer", boxShadow: "var(--shadow)" }}
                    >
                        {s.back}
                    </button>
                ) : <div />}

                {step < 6 ? (
                    <button
                        onClick={nextStep}
                        style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--u-navy)", border: "none", fontWeight: 600, color: "white", cursor: "pointer", boxShadow: "var(--shadow-md)" }}
                    >
                        {s.next} →
                    </button>
                ) : (
                    <button
                        onClick={handleDownloadWord}
                        style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--u-gold)", border: "none", fontWeight: 800, color: "var(--u-navy-d)", cursor: "pointer", boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                        <Download size={18} /> Download Word Document
                    </button>
                )}
            </div>
        </div >
    );
}
