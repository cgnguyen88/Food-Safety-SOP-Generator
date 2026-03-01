import { buildSopStandardContext } from "./sop-standards.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ENV_GEMINI_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "AIzaSyB9Eum_iJF__GfZmhkONVhxMhrlU7nNpJk";
const MODEL_NAME = "gemini-2.5-flash";

function getGeminiModel(systemInstruction) {
  const genAI = new GoogleGenerativeAI(ENV_GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
    }
  });
}

function formatMessages(messages) {
  // Gemini strictly requires chat history to begin with a 'user' message. 
  // Strip any leading assistant messages (like UI greetings) before parsing.
  let startIdx = 0;
  while (startIdx < messages.length && messages[startIdx].role === "assistant") {
    startIdx++;
  }

  return messages.slice(startIdx).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
}

export async function callClaude(messages, systemPrompt) {
  if (!ENV_GEMINI_API_KEY) throw new Error("AI service unavailable. Missing API Key.");

  try {
    const model = getGeminiModel(systemPrompt);
    const formattedHistory = formatMessages(messages);

    // The last message is the current prompt, we separate history from the current prompt for Gemini
    const chat = model.startChat({ history: formattedHistory.slice(0, -1) });
    const currentMessage = formattedHistory[formattedHistory.length - 1].parts[0].text;

    const result = await chat.sendMessage(currentMessage);
    return result.response.text();
  } catch (err) {
    console.error("Gemini request failed:", err);
    throw new Error(err.message || "Request failed.");
  }
}

export async function callClaudeStreaming(messages, systemPrompt, onChunk, onDone = () => { }, onError = async () => { }) {
  if (!ENV_GEMINI_API_KEY) {
    onError(new Error("AI service unavailable. Missing API Key."));
    return;
  }

  try {
    let currentMessage;
    let formattedHistory = [];

    // Normalize string messages input vs array objects input 
    if (typeof messages === "string") {
      currentMessage = messages;
    } else {
      formattedHistory = formatMessages(messages);
      currentMessage = formattedHistory[formattedHistory.length - 1].parts[0].text;
      formattedHistory = formattedHistory.slice(0, -1);
    }

    const model = getGeminiModel(systemPrompt);
    const chat = model.startChat({ history: formattedHistory });

    const result = await chat.sendMessageStream(currentMessage);

    for await (const chunk of result.stream) {
      onChunk(chunk.text());
    }

    onDone();
  } catch (err) {
    console.error("Gemini stream failed:", err);
    onError(err);
    throw err;
  }
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
