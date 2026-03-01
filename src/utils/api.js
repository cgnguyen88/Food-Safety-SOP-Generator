import { buildSopStandardContext } from "./sop-standards.js";
const DIRECT_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const PROXY_ENDPOINT = "/api/claude";
const DIRECT_ENDPOINT = import.meta.env.VITE_ANTHROPIC_API_URL || DIRECT_ANTHROPIC_URL;
const ALLOW_CLIENT_KEY_FALLBACK = import.meta.env.VITE_ALLOW_CLIENT_KEY_FALLBACK === "true";
const ENV_ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
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

function resolveApiKey() {
  const envKey = ENV_ANTHROPIC_API_KEY.trim();
  if (envKey) return envKey;
  return "";
}

async function sendClaudeRequest(payload) {
  const modelCandidates = [...new Set(MODEL_FALLBACKS.filter(Boolean))];
  let lastErr = new Error("Anthropic request failed");
  let apiKey = "";
  const endpoints = ALLOW_CLIENT_KEY_FALLBACK
    ? [PROXY_ENDPOINT, DIRECT_ENDPOINT]
    : [PROXY_ENDPOINT];

  for (const model of modelCandidates) {
    for (const endpoint of endpoints) {
      const isProxyEndpoint = endpoint === "/api/claude";
      if (!isProxyEndpoint && !apiKey) {
        apiKey = resolveApiKey();
        if (!apiKey) {
          throw new Error("AI service unavailable. Configure backend ANTHROPIC_API_KEY.");
        }
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
          ...(!isProxyEndpoint ? { "anthropic-version": "2023-06-01" } : {}),
          ...(!isProxyEndpoint ? { "anthropic-dangerous-direct-browser-access": "true" } : {}),
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
        // If proxy route returns HTML/404 in deployed builds, try next endpoint.
        lastErr = new Error(`AI endpoint failed (${endpoint}, HTTP ${res.status})`);
        continue;
      }

      if (res.ok && !data?.error) return data;

      lastErr = new Error(getErrorMessage(data, res.status));
      if (!apiKey && !isProxyEndpoint && (res.status === 401 || res.status === 403)) {
        lastErr = new Error("AI service unavailable. Configure backend ANTHROPIC_API_KEY.");
      }
      if (!shouldRetryWithAnotherModel(res.status, data)) break;
    }
  }

  throw lastErr;
}

export async function callClaude(messages, systemPrompt) {
  const data = await sendClaudeRequest({ max_tokens: 1500, system: systemPrompt, messages });
  return data.content?.map(b => b.text || "").join("") || "";
}

/**
 * Streaming version of callClaude.
 * Calls onChunk(text) for each token as it arrives.
 * Returns a promise that resolves when the stream is complete.
 */
export async function callClaudeStreaming(messages, systemPrompt, onChunk) {
  const modelCandidates = [...new Set(MODEL_FALLBACKS.filter(Boolean))];
  let lastErr = new Error("Streaming request failed");
  const endpoints = ALLOW_CLIENT_KEY_FALLBACK
    ? [PROXY_ENDPOINT, DIRECT_ENDPOINT]
    : [PROXY_ENDPOINT];

  for (const model of modelCandidates) {
    for (const endpoint of endpoints) {
      const isProxyEndpoint = endpoint === PROXY_ENDPOINT;
      let apiKey = "";
      if (!isProxyEndpoint) {
        apiKey = resolveApiKey();
        if (!apiKey) continue;
      }

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-api-key": apiKey } : {}),
            ...(!isProxyEndpoint ? { "anthropic-version": "2023-06-01" } : {}),
            ...(!isProxyEndpoint ? { "anthropic-dangerous-direct-browser-access": "true" } : {}),
          },
          body: JSON.stringify({ temperature: 0.2, max_tokens: 1500, system: systemPrompt, messages, model, stream: true }),
        });
      } catch (e) {
        lastErr = e;
        continue;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        lastErr = new Error(getErrorMessage(data, res.status));
        if (!shouldRetryWithAnotherModel(res.status, data)) break;
        continue;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") return;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta.text) {
                onChunk(parsed.delta.text);
              }
            } catch { /* ignore malformed SSE lines */ }
          }
        }
        return; // stream finished successfully
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
  }
  throw lastErr;
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

export async function getRecordItemSuggestion(item, sop, formData, farmProfile, recordMeta = {}) {
  const cacheKey = `record-${sop.id}-${item.id}-${JSON.stringify({ formData, farmProfile, recordMeta })}`;
  if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey);

  const sopContext = buildSopStandardContext(sop);
  const systemPrompt = `You are an expert produce safety compliance assistant. Draft concise documentation text for a checklist record item.
${sopContext}

Farm Context:
${farmProfile ? Object.entries(farmProfile).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n") : "No farm profile available."}

Record Context:
- Activity Date: ${recordMeta.activityDate || "N/A"}
- Performed By: ${recordMeta.performedBy || "N/A"}
- Verified By: ${recordMeta.verifiedBy || "N/A"}
- Record Notes: ${recordMeta.notes || "N/A"}

Checklist Item:
- Section: ${item.sectionTitle}
- Item: ${item.label}
- Expected: ${item.expected}

Current SOP Form Values:
${Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n") || "No fields filled yet."}

INSTRUCTIONS:
- Return ONLY the suggested evidence note text. No title, no markdown, no quotes.
- Keep it practical, audit-ready, and specific to this item.
- Include who/what/where (and when if relevant) in 1-3 short sentences.
- Do not invent lab values, legal thresholds, or unverifiable facts.`;

  const messages = [{ role: "user", content: `Draft documentation notes for this checklist item: "${item.label}"` }];

  try {
    const data = await sendClaudeRequest({ max_tokens: 180, system: systemPrompt, messages });
    const suggestion = data.content?.map((b) => b.text || "").join("").trim() || "";
    suggestionCache.set(cacheKey, suggestion);
    return suggestion;
  } catch (e) {
    console.error("Record item AI suggestion failed:", e);
    return null;
  }
}
