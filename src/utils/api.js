import { authedFetch } from "../lib/apiClient.js";

/**
 * The browser side of the AI features. It sends only a mode (which feature), a little context and
 * the language; the server owns the instructions, the model and the limits (api/_lib/modes.js).
 */

/** An AI request that failed, with a message that can be shown as is. */
export class AiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.code = code;
  }
}

const MESSAGES_BY_STATUS = {
  401: "Your session has ended. Please sign in again.",
  413: "This request is too long for the AI assistant. Shorten it and try again.",
  429: "Too many AI requests in a short time. Please wait a moment and try again.",
};

function messageFor(status, serverMessage) {
  if (MESSAGES_BY_STATUS[status]) return MESSAGES_BY_STATUS[status];
  if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage;
  return `The AI service did not answer (error ${status}). Please try again.`;
}

async function post({ mode, messages, context, lang }, { stream = false } = {}) {
  const body = { mode, messages, context, lang, ...(stream ? { stream: true } : {}) };
  let res;
  try {
    res = await authedFetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.code === "not_signed_in") throw error;
    throw new AiError("Could not reach the AI service. Check your connection and try again.", { code: "network" });
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new AiError(messageFor(res.status, data?.error), { status: res.status });
  }
  return res;
}

/**
 * One complete answer.
 * @param {{ mode: string, messages?: Array<{ role: string, content: string }>, context?: object, lang?: 'en' | 'es' }} request
 * @returns {Promise<string>}
 */
export async function askAI(request) {
  const res = await post(request);
  const data = await res.json().catch(() => null);
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("");
}

/**
 * An answer streamed piece by piece. Resolves only when the server says the answer is complete; an
 * answer that stops early is an error, so nobody keeps a cut-off text by mistake.
 *
 * @param {{ mode: string, messages?: Array<{ role: string, content: string }>, context?: object, lang?: 'en' | 'es' }} request
 * @param {(chunk: string) => void} onChunk
 * @returns {Promise<{ text: string, truncated: boolean }>} `truncated` when the answer hit the length limit
 */
export async function streamAI(request, onChunk) {
  const res = await post(request, { stream: true });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let truncated = false;

  // Handles one line of the event stream; true once the server says the answer is complete.
  const handle = (line) => {
    if (!line.startsWith("data: ")) return false;
    const data = line.slice(6).trim();
    if (data === "[DONE]") return true;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return false; // not one of ours; skip it
    }
    if (event?.error) throw new AiError(event.error.message || "The AI service stopped answering. Please try again.");
    const choice = event?.choices?.[0];
    if (choice?.finish_reason === "length") truncated = true;
    const chunk = choice?.delta?.content;
    if (typeof chunk === "string" && chunk) {
      text += chunk;
      onChunk(chunk);
    }
    return false;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (handle(line)) return { text, truncated };
      }
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError("The connection to the AI service dropped. Please try again.", { code: "network" });
  }
  if (handle(buffer)) return { text, truncated };
  throw new AiError("The answer was cut off before it finished. Please try again.", { code: "incomplete" });
}

// ─── Conversations ───────────────────────────────────────────────────────────

const MAX_TURNS = 30;

/**
 * The chat as shown on screen, turned into what the model reads: no greeting before the person's
 * first message, no error or empty bubbles, turns of the same speaker joined, only the latest turns.
 *
 * @param {Array<{ role: string, content: string, error?: boolean }>} shown
 * @param {number} [maxTurns]
 * @returns {Array<{ role: 'user' | 'assistant', content: string }>}
 */
export function toConversation(shown, maxTurns = MAX_TURNS) {
  const turns = [];
  for (const message of shown) {
    if (message.error || typeof message.content !== "string" || !message.content.trim()) continue;
    const role = message.role === "assistant" ? "assistant" : "user";
    const last = turns.at(-1);
    if (last?.role === role) turns[turns.length - 1] = { role, content: `${last.content}\n\n${message.content}` };
    else turns.push({ role, content: message.content });
  }
  let recent = turns.slice(-maxTurns);
  while (recent.length && recent[0].role !== "user") recent = recent.slice(1);
  return recent;
}

// ─── Form fields and checklist notes ─────────────────────────────────────────

const MAX_CACHED = 100;
const suggestionCache = new Map();

/** Forget remembered suggestions (for tests, and after signing out). */
export function clearSuggestionCache() {
  suggestionCache.clear();
}

async function remembered(request) {
  const key = JSON.stringify(request);
  if (suggestionCache.has(key)) return suggestionCache.get(key);
  const value = (await askAI(request)).trim();
  if (!value) throw new AiError("The AI returned no text. Please try again.", { code: "empty" });
  if (suggestionCache.size >= MAX_CACHED) suggestionCache.delete(suggestionCache.keys().next().value);
  suggestionCache.set(key, value);
  return value;
}

/** A suggested value for one SOP form field (never empty). @throws {AiError} */
export function getFieldSuggestion(field, sop, formData, farmProfile, lang) {
  return remembered({ mode: "sop_field", lang, context: { sopId: sop.id, fieldId: field.id, form: formData, farm: farmProfile } });
}

// ─── Form updates inside a chat answer ───────────────────────────────────────

const FORM_UPDATE = /<form_update>([\s\S]*?)<\/form_update>/;

/**
 * The fields the assistant filled in, from the first <form_update> block: only the given field ids,
 * each with text or a list of text. Null when there is nothing usable.
 *
 * @param {string} text
 * @param {string[]} allowedIds
 * @returns {Record<string, string | string[]> | null}
 */
export function parseFormUpdates(text, allowedIds) {
  const match = text.match(FORM_UPDATE);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const updates = {};
  for (const id of allowedIds) {
    if (!Object.hasOwn(parsed, id)) continue;
    const value = parsed[id];
    if (typeof value === "string") updates[id] = value;
    else if (Array.isArray(value)) updates[id] = value.filter((v) => typeof v === "string");
  }
  return Object.keys(updates).length ? updates : null;
}

/** The answer without its update blocks, including one that is still arriving. */
export function stripFormUpdate(text) {
  return text
    .replace(/<form_update>[\s\S]*?<\/form_update>/g, "")
    .replace(/<form_update>[\s\S]*$/, "")
    .trim();
}
