// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Droplets } from 'lucide-react';
import LogGroup from './LogGroup.jsx';
import { GLOBAL_CSS } from '../../styles/global.js';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const setup = (props = {}) => {
  const user = userEvent.setup();
  const view = render(
    <LogGroup id="sanitation" label="Sanitation" icon={Droplets} accent="#0e7490" count={2} {...props}>
      <li className="log-row"><button type="button">Sanitation Log</button></li>
      <li className="log-row"><button type="button">Sanitizer Labels</button></li>
    </LogGroup>,
  );
  return { user, ...view };
};
const header = () => screen.getByRole('button', { name: 'Sanitation' });

describe('LogGroup', () => {
  it('is a labelled region whose heading says whether it is open and which list it controls', () => {
    const { container } = setup({ defaultOpen: true });
    expect(screen.getByRole('region', { name: 'Sanitation' })).toBeTruthy();
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(header().getAttribute('aria-controls')).toBe(container.querySelector('ul').id);
  });

  it('is closed by default, and shows how many logs are inside without listing them', () => {
    const { container } = setup();
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.querySelector('ul').hidden).toBe(true);
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Sanitation Log' })).toBeNull();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('opens into one list, the logs in the order given, one under the other', async () => {
    const { user } = setup();
    await user.click(header());
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Sanitation Log', 'Sanitizer Labels']);
    expect(header().getAttribute('aria-expanded')).toBe('true');
    await user.click(header());
    expect(screen.queryByRole('button', { name: 'Sanitation Log' })).toBeNull();
  });

  it('remembers how it was left, for each group on its own', async () => {
    const first = setup();
    await first.user.click(header());
    first.unmount();
    setup();
    expect(header().getAttribute('aria-expanded')).toBe('true');
    cleanup();
    setup({ id: 'people' });
    expect(header().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the group’s name as written, with no inline capital letters, and a decorative icon', () => {
    const { container } = setup();
    expect(header().textContent.startsWith('Sanitation')).toBe(true);
    expect(header().style.textTransform).toBe('');
    expect(within(header()).getByText('Sanitation').style.textTransform).toBe('');
    expect(container.querySelector('.log-group-icon').getAttribute('aria-hidden')).toBe('true');
  });

  it('carries its colour to the guide line that ties its logs to it', () => {
    const { container } = setup();
    expect(container.querySelector('.log-group').style.getPropertyValue('--group-accent')).toBe('#0e7490');
  });

  it('sets its logs in from the group name, with a guide line down the left, so the two levels are easy to tell apart', () => {
    const rule = (selector) => GLOBAL_CSS.split('}').find((chunk) => chunk.includes(`${selector} {`)) ?? '';
    const leftPadding = (selector) => Number(/padding:\s*\d+px\s+\d+px\s+\d+px\s+(\d+)px/.exec(rule(selector))?.[1]);
    // The group's own icon starts 16px in and its name 60px in: the logs start under the name, not under the icon.
    expect(leftPadding('.log-row-open')).toBeGreaterThanOrEqual(60);
    expect(rule('.log-group-body::before')).toMatch(/var\(--group-accent/);
  });

  it('is never styled in capitals, and is dark enough to read', () => {
    const rule = (selector) => GLOBAL_CSS.split('}').find((chunk) => chunk.includes(`${selector} {`)) ?? '';
    for (const selector of ['.log-group-header', '.log-group-title', '.log-group-count']) expect(rule(selector), selector).not.toMatch(/uppercase|capitalize/);
    expect(rule('.log-group-header')).toMatch(/color: var\(--u-navy\)/);
  });
});
