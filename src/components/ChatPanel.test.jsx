// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageContext } from '../i18n/LanguageContext.jsx';
import { SOP_DATA } from '../data/sop-data.js';

vi.mock('../utils/api.js', async (importOriginal) => ({ ...(await importOriginal()), streamAI: vi.fn() }));
const { streamAI } = await import('../utils/api.js');
const { default: ChatPanel } = await import('./ChatPanel.jsx');

const SOP = SOP_DATA[0];
Element.prototype.scrollIntoView = () => {};

function renderChat(lang = 'en') {
  const onFormUpdate = vi.fn();
  render(
    <LanguageContext.Provider value={{ lang, toggleLang: () => {} }}>
      <ChatPanel sop={SOP} formData={{ farm_name: 'GV' }} onFormUpdate={onFormUpdate} farmProfile={{ farm_name: 'Green Valley' }} />
    </LanguageContext.Provider>,
  );
  return { onFormUpdate };
}

async function ask(text) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox'), `${text}{Enter}`);
  return user;
}

const answerWith = (text, extra = {}) => streamAI.mockImplementation(async (_request, onChunk) => {
  onChunk(text);
  return { text, truncated: false, ...extra };
});

beforeEach(() => {
  streamAI.mockReset();
});
afterEach(cleanup);

describe('ChatPanel', () => {
  it('asks the server in the SOP chat mode, sending the conversation without the greeting', async () => {
    answerWith('Happy to help.');
    renderChat();
    await ask('What goes in handwashing?');
    await waitFor(() => expect(streamAI).toHaveBeenCalled());
    const [request] = streamAI.mock.calls[0];
    expect(request).toMatchObject({ mode: 'sop_chat', lang: 'en', context: { sopId: SOP.id, form: { farm_name: 'GV' }, farm: { farm_name: 'Green Valley' } } });
    expect(request.messages).toEqual([{ role: 'user', content: 'What goes in handwashing?' }]);
    expect(await screen.findByText('Happy to help.')).toBeTruthy();
  });

  it('shows the fields the assistant wants to fill, and changes the form only when Apply is pressed', async () => {
    answerWith('Here is a draft.\n<form_update>{"hw_station_locations": "Field entrance", "made_up": "x"}</form_update>');
    const { onFormUpdate } = renderChat();
    const user = await ask('Fill in the stations');
    const proposal = await screen.findByRole('group', { name: /suggested changes/i });
    expect(proposal.textContent).toContain('Handwashing Station Locations');
    expect(proposal.textContent).toContain('Field entrance');
    expect(proposal.textContent).not.toContain('made_up');
    expect(onFormUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply to form' }));
    expect(onFormUpdate).toHaveBeenCalledWith({ hw_station_locations: 'Field entrance' });
    expect(screen.queryByRole('button', { name: 'Apply to form' })).toBeNull();
    expect(screen.getByText(/updated the relevant fields/i)).toBeTruthy();
  });

  it('leaves the form alone when the suggestion is dismissed', async () => {
    answerWith('<form_update>{"hw_station_locations": "Somewhere"}</form_update>');
    const { onFormUpdate } = renderChat();
    const user = await ask('Fill it');
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(onFormUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /suggested changes/i })).toBeNull();
  });

  it('shows an error in place of the answer', async () => {
    streamAI.mockRejectedValue(new Error('Too many AI requests in a short time. Please wait a moment and try again.'));
    renderChat();
    await ask('Hello');
    expect((await screen.findByRole('alert')).textContent).toMatch(/wait a moment/);
  });

  it('labels the suggestion in Spanish in the Spanish app', async () => {
    answerWith('<form_update>{"hw_station_locations": "Entrada"}</form_update>');
    renderChat('es');
    await ask('Llénalo');
    expect(await screen.findByRole('button', { name: 'Aplicar al formulario' })).toBeTruthy();
  });
});
