import { buildSopStandardContext } from "./sop-standards.js";
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const MODEL = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-0";
const MODEL_FALLBACKS = [
  MODEL,
  "claude-sonnet-4-0",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-latest",
];

function getErrorMessage(data, status) {
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === "string") return data.error;
  return `Anthropic request failed (HTTP ${status})`;
}

function shouldRetryWithAnotherModel(status, data) {
  const code = data?.error?.type || data?.error?.code || "";
  const message = (data?.error?.message || "").toLowerCase();
  return status === 404 || code.includes("model") || message.includes("model");
}

async function sendClaudeRequest(payload) {
  const modelCandidates = [...new Set(MODEL_FALLBACKS.filter(Boolean))];
  let lastErr = new Error("Anthropic request failed");

  for (const model of modelCandidates) {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        temperature: 0.2,
        ...payload,
        model,
      }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Anthropic response was not valid JSON (HTTP ${res.status})`);
    }

    if (res.ok && !data?.error) return data;

    lastErr = new Error(getErrorMessage(data, res.status));
    if (!shouldRetryWithAnotherModel(res.status, data)) break;
  }

  throw lastErr;
}

export async function callClaude(messages, systemPrompt) {
  const data = await sendClaudeRequest({ max_tokens: 1500, system: systemPrompt, messages });
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
  const contextFingerprint = JSON.stringify({
    formData,
    farmProfile,
  });
  const cacheKey = `${field.id}-${sop.id}-${contextFingerprint}`;
  if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey);

  const sopContext = buildSopStandardContext(sop);
  const systemPrompt = `You are an expert FSMA Produce Safety Rule compliance assistant. Generate a specific, compliant value for a single SOP form field.
${sopContext}
 
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
- Stay strictly within this SOP's standard and scope.
- Be specific and regulatory-compliant.
- For textarea fields, format each item as a bullet point line starting with "• " (bullet + space). Use one bullet per distinct item or step. Use actual newlines between bullets.
- Follow FSMA PSR, Cornell PSA, and industry best practices.
- Do not fabricate legal thresholds, dates, or citations. If a numeric requirement is uncertain, use conservative procedural wording.
- If the field is about locations/names specific to the farm, provide a realistic template the user can customize.`;

  const messages = [{ role: "user", content: `Generate the value for the "${field.label}" field.` }];

  try {
    const data = await sendClaudeRequest({ max_tokens: 300, system: systemPrompt, messages });
    const suggestion = data.content?.map(b => b.text || "").join("") || "";
    suggestionCache.set(cacheKey, suggestion);
    return suggestion;
  } catch (e) {
    console.error("AI suggestion failed:", e);
    return null;
  }
}
