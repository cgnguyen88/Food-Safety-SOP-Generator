import { z } from 'zod';
import { CHAT_MODES, MODE_IDS, ModeContextError, buildPrompt } from './modes.js';

// This endpoint takes text only: the browser features that use it never send files.
const textBlock = z.object({ type: z.literal('text'), text: z.string().min(1) });
const content = z.union([z.string().min(1), z.array(textBlock).min(1)]);

const messageSchema = z.object({ role: z.enum(['user', 'assistant']), content });

// Unknown keys (model, max_tokens, tools, temperature, cache_control, system, ...) are stripped: the
// browser may only choose a registered mode (the server owns the instructions), send the
// conversation for a chat mode, the interface language, a small context and stream.
const requestSchema = z.object({
  mode: z.enum(MODE_IDS),
  messages: z.array(messageSchema).min(1).optional(),
  lang: z.enum(['en', 'es']).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional(),
});

const textLength = (value) => (typeof value === 'string' ? value.length : value.reduce((sum, block) => sum + block.text.length, 0));

const reject = (status, error) => ({ ok: false, status, error });

/**
 * Validate a /api/claude request body and turn it into the upstream messages and instructions.
 *
 * @param {unknown} body
 * @param {{ maxMessages: number, maxTotalChars: number, maxContextChars: number }} limits
 * @returns {{ ok: true, value: { messages: Array<{ role: 'user' | 'assistant', content: unknown }>, system: string, stream: boolean } }
 *   | { ok: false, status: 400 | 413, error: string }}
 */
export function validateClaudeRequest(body, limits) {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return reject(400, 'Invalid request: expected { mode, messages?, lang?, context?, stream? }.');
  }
  const { mode, messages, lang, context, stream } = parsed.data;
  const isChat = CHAT_MODES.includes(mode);

  if (isChat && !messages) return reject(400, 'Invalid request: this mode needs the conversation.');
  if (!isChat && messages) return reject(400, 'Invalid request: this mode does not take a conversation.');
  if (messages && messages[0].role !== 'user') return reject(400, 'Invalid request: the first message must be from the user.');
  // An assistant turn at the end would put words in the model's mouth (a "prefill").
  if (messages && messages.at(-1).role !== 'user') return reject(400, 'Invalid request: the last message must be from the user.');
  if (messages && messages.length > limits.maxMessages) return reject(413, 'Too many messages in one request.');
  if (messages && messages.reduce((sum, m) => sum + textLength(m.content), 0) > limits.maxTotalChars) return reject(413, 'Request is too large.');
  if (context && JSON.stringify(context).length > limits.maxContextChars) return reject(413, 'Request is too large.');

  let prompt;
  try {
    prompt = buildPrompt(mode, { lang, context });
  } catch (error) {
    if (error instanceof ModeContextError) return reject(400, `Invalid request: ${error.message}`);
    throw error;
  }

  return {
    ok: true,
    value: {
      messages: isChat ? messages : [{ role: 'user', content: prompt.task }],
      system: prompt.system,
      stream: stream === true,
    },
  };
}
