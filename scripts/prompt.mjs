import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

/**
 * Ask one question in the terminal. With `hidden`, nothing typed is ever written to the screen: the
 * question is printed first, and everything readline writes after it (including the redraws that
 * Backspace and the arrow keys cause, which repeat the whole line) goes nowhere.
 *
 * @param {string} question
 * @param {{ hidden?: boolean, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} [options]
 * @returns {Promise<string>} the answer, trimmed
 */
export function ask(question, { hidden = false, input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve) => {
    let muted = false;
    const screen = new Writable({
      write(chunk, encoding, done) {
        if (!muted) output.write(chunk, encoding);
        done();
      },
    });
    screen.columns = output.columns;
    const rl = createInterface({ input, output: screen, terminal: true });
    output.write(question);
    muted = hidden;
    rl.question('', (answer) => {
      rl.close();
      if (hidden) output.write('\n');
      resolve(answer.trim());
    });
  });
}
