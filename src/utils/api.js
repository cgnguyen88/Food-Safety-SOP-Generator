import { buildSopStandardContext } from "./sop-standards.js";

const MODEL = "claude-haiku-4-5-20251001";

function formatMessages(messages) {
  // Anthropic requires the first message to be from "user"
  let startIdx = 0;
  while (startIdx < messages.length && messages[startIdx].role === "assistant") {
    startIdx++;
  }
  return messages.slice(startIdx).map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

export async function callClaude(messages, systemPrompt) {
  const formatted = formatMessages(messages);
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: formatted,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export async function callClaudeStreaming(messages, systemPrompt, onChunk, onDone = () => {}, onError = async () => {}) {
  const formatted = formatMessages(messages);
  let res;
  try {
    res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: formatted,
        stream: true,
      }),
    });
  } catch (err) {
    onError(err);
    throw err;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData?.error?.message || `API error ${res.status}`);
    onError(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep any incomplete line for the next chunk

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          // Anthropic SSE sends content_block_delta events with text_delta
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            onChunk(parsed.delta.text);
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } catch (err) {
    onError(err);
    throw err;
  }

  onDone();
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
  const contextFingerprint = JSON.stringify({ formData, farmProfile });
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
    const suggestion = await callClaude(messages, systemPrompt);
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
    const suggestion = await callClaude(messages, systemPrompt);
    suggestionCache.set(cacheKey, suggestion.trim());
    return suggestion.trim();
  } catch (e) {
    console.error("Record item AI suggestion failed:", e);
    return null;
  }
}
