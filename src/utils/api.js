const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const MODEL = "claude-sonnet-4-5-20250929";

export async function callClaude(messages, systemPrompt) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: systemPrompt, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(b => b.text || "").join("") || "";
}

export function parseFormUpdates(text) {
  const match = text.match(/<form_update>([\s\S]*?)<\/form_update>/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

export function stripFormUpdate(text) {
  return text.replace(/<form_update>[\s\S]*?<\/form_update>/g, "").trim();
}

const suggestionCache = new Map();

export async function getFieldSuggestion(field, sop, formData, farmProfile) {
  const cacheKey = `${field.id}-${sop.id}`;
  if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey);

  const systemPrompt = `You are an expert FSMA Produce Safety Rule compliance assistant. Generate a specific, compliant value for a single SOP form field.
 
Farm Context:
${farmProfile ? Object.entries(farmProfile).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n") : "No farm profile available — use general best practices."}

SOP: ${sop.title} (${sop.ref})
Field: ${field.label}
Field Type: ${field.type}
Placeholder/Example: ${field.ph || "None"}
${field.required ? "This field is REQUIRED." : ""}

Current form values for context:
${Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n") || "No fields filled yet."}

INSTRUCTIONS:
- Provide ONLY the field value — no explanation, no preamble, no quotes.
- Be specific and regulatory-compliant.
- For textarea fields, format each item as a bullet point line starting with "• " (bullet + space). Use one bullet per distinct item or step. Use actual newlines between bullets.
- Follow FSMA PSR, Cornell PSA, and industry best practices.
- If the field is about locations/names specific to the farm, provide a realistic template the user can customize.`;

  const messages = [{ role: "user", content: `Generate the value for the "${field.label}" field.` }];

  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system: systemPrompt, messages }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const suggestion = data.content?.map(b => b.text || "").join("") || "";
    suggestionCache.set(cacheKey, suggestion);
    return suggestion;
  } catch (e) {
    console.error("AI suggestion failed:", e);
    return null;
  }
}
