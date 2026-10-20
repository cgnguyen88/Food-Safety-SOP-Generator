// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderWithLang } from './records/testUtils.jsx';
import { SOP_DATA } from '../data/sop-data.js';
import SOPEditor from './SOPEditor.jsx';

const SOP = SOP_DATA[0];

const setup = (props = {}) => {
  const onSaveForm = vi.fn();
  renderWithLang(<SOPEditor sop={SOP} farmProfile={null} onBack={() => {}} onSaveForm={onSaveForm} {...props} />);
  return { onSaveForm };
};
const box = (id) => document.getElementById(`field-${id}`).querySelector('input, textarea');

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

vi.mock('./ShareSopModal.jsx', () => ({ default: ({ sopId, filledIn, onClose }) => <div role="dialog" aria-label="share">{`share ${sopId} ${filledIn ? 'filled' : 'empty'}`}<button onClick={onClose}>close share</button></div> }));

describe('SOPEditor: sharing with workers', () => {
  it('offers sharing to people who may share, with the farm', () => {
    setup({ canShare: true, farmId: 'farm-1' });
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it.each([[{ canShare: false, farmId: 'farm-1' }], [{ canShare: true }], [{}]])('does not offer it otherwise (%j)', (props) => {
    setup(props);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('opens and closes the share window, telling it whether the SOP has anything in it', () => {
    setup({ canShare: true, farmId: 'farm-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'share' }).textContent).toContain('share 1 empty');
    fireEvent.click(screen.getByRole('button', { name: 'close share' }));
    expect(screen.queryByRole('dialog', { name: 'share' })).toBeNull();
    fireEvent.change(box('prepared_by'), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'share' }).textContent).toContain('share 1 filled');
  });
});

describe('SOPEditor: keeping what was written', () => {
  it('starts from what the farm saved for this SOP', () => {
    setup({ savedForm: { farm_name: 'Green Valley Farm' } });
    expect(screen.getByDisplayValue('Green Valley Farm')).toBeTruthy();
  });

  it('lets what was saved win over the farm profile, which only fills what is empty', () => {
    setup({ farmProfile: { farm_name: 'From Profile', owner_name: 'Pat Owner' }, savedForm: { farm_name: 'Saved Name' } });
    expect(screen.getByDisplayValue('Saved Name')).toBeTruthy();
    expect(screen.queryByDisplayValue('From Profile')).toBeNull();
    expect(screen.getByDisplayValue('Pat Owner')).toBeTruthy();
  });

  it('saves the whole form after each change', () => {
    const { onSaveForm } = setup({ savedForm: { farm_name: 'Green Valley Farm' } });
    fireEvent.change(box('prepared_by'), { target: { value: 'Maria' } });
    expect(onSaveForm).toHaveBeenCalledTimes(1);
    expect(onSaveForm.mock.calls[0][0]).toMatchObject({ farm_name: 'Green Valley Farm', prepared_by: 'Maria' });
  });

  it('keeps earlier changes when a later one is saved', () => {
    const { onSaveForm } = setup();
    fireEvent.change(box('farm_name'), { target: { value: 'One' } });
    fireEvent.change(box('prepared_by'), { target: { value: 'Two' } });
    expect(onSaveForm.mock.calls.at(-1)[0]).toMatchObject({ farm_name: 'One', prepared_by: 'Two' });
  });

  it('lets someone who cannot save still fill the form in', () => {
    setup({ onSaveForm: undefined });
    fireEvent.change(box('farm_name'), { target: { value: 'Typed' } });
    expect(screen.getByDisplayValue('Typed')).toBeTruthy();
  });

  it('does not save anything just by opening a SOP', () => {
    const { onSaveForm } = setup({ farmProfile: { farm_name: 'Green Valley Farm' } });
    expect(onSaveForm).not.toHaveBeenCalled();
  });
});
