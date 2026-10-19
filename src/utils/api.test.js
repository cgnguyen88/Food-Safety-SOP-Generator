import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/apiClient.js', () => ({ authedFetch: vi.fn() }));

const { authedFetch } = await import('../lib/apiClient.js');
const api = await import('./api.js');
const { askAI, streamAI, AiError, getFieldSuggestion, getRecordItemSuggestion, parseFormUpdates, stripFormUpdate, toConversation } = api;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sse = (...events) => new Response(events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const delta = (content) => ({ choices: [{ delta: { content } }] });
const sentBody = (call = 0) => JSON.parse(authedFetch.mock.calls[call][1].body);

beforeEach(() => {
  authedFetch.mockReset();
  api.clearSuggestionCache();
});

describe('askAI', () => {
  it('posts the mode, context and language to /api/claude with the sign-in token, and returns the text', async () => {
    authedFetch.mockResolvedValue(json(200, { content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'there' }] }));
    const text = await askAI({ mode: 'sop_field', context: { sopId: 1, fieldId: 'f' }, lang: 'es' });
    expect(text).toBe('Hello there');
    const [url, init] = authedFetch.mock.calls[0];
    expect(url).toBe('/api/claude');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(sentBody()).toEqual({ mode: 'sop_field', context: { sopId: 1, fieldId: 'f' }, lang: 'es' });
  });

  it('never sends instructions, a model or a token budget', async () => {
    authedFetch.mockResolvedValue(json(200, { content: [] }));
    await askAI({ mode: 'assistant', messages: [{ role: 'user', content: 'hi' }], system: 'x', model: 'y', max_tokens: 1 });
    expect(Object.keys(sentBody()).sort()).toEqual(['messages', 'mode']);
  });

  it.each([
    [401, {}, /sign in again/i],
    [429, { error: 'Too many requests' }, /wait a moment/i],
    [413, {}, /too long/i],
    [503, { error: 'The AI service is not available right now.' }, /not available right now/],
    [502, {}, /did not answer/i],
  ])('turns HTTP %i into a clear message', async (status, body, message) => {
    authedFetch.mockResolvedValue(json(status, body));
    const error = await askAI({ mode: 'assistant', messages: [] }).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.status).toBe(status);
    expect(error.message).toMatch(message);
  });

  it('explains a network failure, and passes the signed-out error through', async () => {
    authedFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(askAI({ mode: 'assistant' })).rejects.toThrow(/could not reach/i);
    authedFetch.mockRejectedValueOnce(Object.assign(new Error('Please sign in to use this feature.'), { code: 'not_signed_in' }));
    await expect(askAI({ mode: 'assistant' })).rejects.toMatchObject({ code: 'not_signed_in' });
  });
});

describe('streamAI', () => {
  it('hands each piece of text to onChunk as it arrives, and returns the whole answer', async () => {
    authedFetch.mockResolvedValue(sse(delta('Hel'), delta('lo'), '[DONE]'));
    const chunks = [];
    const result = await streamAI({ mode: 'assistant', messages: [{ role: 'user', content: 'hi' }] }, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ text: 'Hello', truncated: false });
    expect(sentBody().stream).toBe(true);
  });

  it('copes with events split across network reads', async () => {
    const encoder = new TextEncoder();
    const parts = ['data: {"choices":[{"delta":{"content":"A"}}]}\n', '\ndata: {"choices":[{"del', 'ta":{"content":"B"}}]}\n\ndata: [DONE]\n\n'];
    const body = new ReadableStream({ start(c) { parts.forEach((p) => c.enqueue(encoder.encode(p))); c.close(); } });
    authedFetch.mockResolvedValue(new Response(body, { status: 200 }));
    expect((await streamAI({ mode: 'assistant' }, () => {})).text).toBe('AB');
  });

  it('reports an answer cut short by the length limit', async () => {
    authedFetch.mockResolvedValue(sse(delta('Part'), { choices: [{ delta: {}, finish_reason: 'length' }] }, '[DONE]'));
    expect(await streamAI({ mode: 'assistant' }, () => {})).toEqual({ text: 'Part', truncated: true });
  });

  it('fails, instead of keeping a cut-off answer, when the server reports an error or the stream stops early', async () => {
    authedFetch.mockResolvedValueOnce(sse(delta('Par'), { error: { message: 'The AI service is busy.' } }));
    await expect(streamAI({ mode: 'assistant' }, () => {})).rejects.toThrow('The AI service is busy.');
    authedFetch.mockResolvedValueOnce(sse(delta('Par')));
    await expect(streamAI({ mode: 'assistant' }, () => {})).rejects.toThrow(/cut off/i);
  });

  it('turns an HTTP error into a clear message before any text arrives', async () => {
    authedFetch.mockResolvedValue(json(429, {}));
    const onChunk = vi.fn();
    await expect(streamAI({ mode: 'assistant' }, onChunk)).rejects.toThrow(/wait a moment/i);
    expect(onChunk).not.toHaveBeenCalled();
  });
});

describe('getFieldSuggestion', () => {
  const sop = { id: 1 };
  const field = { id: 'hw_station_locations' };

  it('asks the server for one field of one SOP, with the farm and form as context', async () => {
    authedFetch.mockResolvedValue(json(200, { content: [{ type: 'text', text: '  • Field entrance  ' }] }));
    const value = await getFieldSuggestion(field, sop, { farm_name: 'GV' }, { farm_name: 'Green Valley' }, 'es');
    expect(value).toBe('• Field entrance');
    expect(sentBody()).toEqual({ mode: 'sop_field', lang: 'es', context: { sopId: 1, fieldId: 'hw_station_locations', form: { farm_name: 'GV' }, farm: { farm_name: 'Green Valley' } } });
  });

  it('remembers an answer for the same question, but asks again when anything changes', async () => {
    authedFetch.mockImplementation(async () => json(200, { content: [{ type: 'text', text: 'v' }] }));
    await getFieldSuggestion(field, sop, {}, null, 'en');
    await getFieldSuggestion(field, sop, {}, null, 'en');
    expect(authedFetch).toHaveBeenCalledTimes(1);
    await getFieldSuggestion(field, sop, { a: 'changed' }, null, 'en');
    await getFieldSuggestion(field, sop, {}, null, 'es');
    expect(authedFetch).toHaveBeenCalledTimes(3);
  });

  it('treats an empty answer as a failure, and does not remember it', async () => {
    authedFetch.mockResolvedValueOnce(json(200, { content: [{ type: 'text', text: '   ' }] }));
    await expect(getFieldSuggestion(field, sop, {}, null, 'en')).rejects.toMatchObject({ code: 'empty' });
    authedFetch.mockResolvedValueOnce(json(200, { content: [{ type: 'text', text: 'second try' }] }));
    expect(await getFieldSuggestion(field, sop, {}, null, 'en')).toBe('second try');
  });

  it('does not remember a failure', async () => {
    authedFetch.mockResolvedValueOnce(json(502, {}));
    await expect(getFieldSuggestion(field, sop, {}, null, 'en')).rejects.toBeInstanceOf(AiError);
    authedFetch.mockResolvedValueOnce(json(200, { content: [{ type: 'text', text: 'ok' }] }));
    expect(await getFieldSuggestion(field, sop, {}, null, 'en')).toBe('ok');
  });
});

describe('getRecordItemSuggestion', () => {
  it('asks for a note on one checklist item, with the record details', async () => {
    authedFetch.mockResolvedValue(json(200, { content: [{ type: 'text', text: ' Checked by Ana. ' }] }));
    const record = { activityDate: '2026-10-18', performedBy: 'Ana', verifiedBy: 'Luis', notes: '' };
    const note = await getRecordItemSuggestion({ id: 'handwash-hw_station_locations', label: 'x' }, { id: 1 }, { a: 'b' }, { farm_name: 'GV' }, record, 'en');
    expect(note).toBe('Checked by Ana.');
    expect(sentBody()).toEqual({ mode: 'record_note', lang: 'en', context: { sopId: 1, itemId: 'handwash-hw_station_locations', form: { a: 'b' }, farm: { farm_name: 'GV' }, record } });
  });
});

describe('form updates in a chat answer', () => {
  const allowed = ['farm_name', 'hw_frequency'];

  it('reads the fields the assistant filled in, keeping only known fields with text or lists of text', () => {
    const text = 'Here you go.\n<form_update>\n{"farm_name": "Green Valley", "hw_frequency": ["Before work", 3], "made_up": "x", "toString": "y"}\n</form_update>';
    expect(parseFormUpdates(text, allowed)).toEqual({ farm_name: 'Green Valley', hw_frequency: ['Before work'] });
  });

  it('returns null for a missing, broken or empty update', () => {
    expect(parseFormUpdates('No update here', allowed)).toBeNull();
    expect(parseFormUpdates('<form_update>{not json}</form_update>', allowed)).toBeNull();
    expect(parseFormUpdates('<form_update>["a"]</form_update>', allowed)).toBeNull();
    expect(parseFormUpdates('<form_update>{"made_up": "x"}</form_update>', allowed)).toBeNull();
  });

  it('hides the update block from the reader, including one still arriving', () => {
    expect(stripFormUpdate('Done.\n<form_update>{"a": 1}</form_update>\nAnything else?')).toBe('Done.\n\nAnything else?');
    expect(stripFormUpdate('Filling it in now.\n<form_update>{"farm_na')).toBe('Filling it in now.');
  });
});

describe('toConversation', () => {
  it('starts with the person: the greeting and other opening assistant bubbles are not sent', () => {
    const shown = [{ role: 'assistant', content: 'Hello, I am Jimmy' }, { role: 'user', content: 'Hi' }];
    expect(toConversation(shown)).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('leaves out error bubbles and empty bubbles, and joins turns that end up side by side', () => {
    const shown = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'Connection error', error: true },
      { role: 'user', content: 'Second try' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: 'Answer' },
    ];
    expect(toConversation(shown)).toEqual([
      { role: 'user', content: 'First question\n\nSecond try' },
      { role: 'assistant', content: 'Answer' },
    ]);
  });

  it('keeps only the most recent turns, still starting with the person', () => {
    const shown = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    const sent = toConversation(shown, 10);
    expect(sent.length).toBeLessThanOrEqual(10);
    expect(sent[0].role).toBe('user');
    expect(sent.at(-1).content).toBe('m49');
  });

  it('sends only the role and the text', () => {
    expect(toConversation([{ role: 'user', content: 'Hi', streaming: false, id: 3 }])).toEqual([{ role: 'user', content: 'Hi' }]);
  });
});
