import { describe, it, expect } from 'vitest';
import { PassThrough, Writable } from 'node:stream';
import { ask } from './prompt.mjs';

/** A pretend terminal: keys go in, and everything the prompt would show on screen is collected. */
function terminal() {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => input;
  let shown = '';
  const output = new Writable({ write(chunk, _encoding, done) { shown += chunk.toString(); done(); } });
  output.isTTY = true;
  output.columns = 80;
  return { input, output, shown: () => shown };
}

const type = (input, text) => new Promise((resolve) => { input.write(text); setImmediate(resolve); });

describe('ask', () => {
  it('never shows a hidden answer, even when Backspace and the arrow keys make the line redraw', async () => {
    const t = terminal();
    const answer = ask('Anthropic key: ', { hidden: true, input: t.input, output: t.output });
    await type(t.input, 'sk-ant-supersecret');
    await type(t.input, '\x7f'); // Backspace
    await type(t.input, '\x1b[D'); // left arrow
    await type(t.input, 'T');
    await type(t.input, '\r');
    expect(await answer).toBe('sk-ant-supersecrTe');
    expect(t.shown()).toContain('Anthropic key: ');
    expect(t.shown()).not.toMatch(/supersec|sk-ant/);
  });

  it('shows an ordinary answer as it is typed', async () => {
    const t = terminal();
    const answer = ask('Remove them? [y/N] ', { hidden: false, input: t.input, output: t.output });
    await type(t.input, 'yes\r');
    expect(await answer).toBe('yes');
    expect(t.shown()).toContain('yes');
  });
});
