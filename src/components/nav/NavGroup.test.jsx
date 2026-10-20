// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'lucide-react';
import NavGroup from './NavGroup.jsx';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const setup = (props = {}) => {
  const user = userEvent.setup();
  const view = render(<NavGroup id="trace" label="Traceability" icon={Route} accent="#5bbcf0" count={2} {...props}><button type="button">Item one</button></NavGroup>);
  return { user, ...view };
};
const heading = () => screen.getByRole('button', { name: /^Traceability/ });

describe('NavGroup', () => {
  it('is a card with a real expand/collapse heading, open by default, with its items inside', () => {
    const { container } = setup();
    expect(container.querySelector('.nav-section')).toBeTruthy();
    expect(heading().getAttribute('aria-expanded')).toBe('true');
    expect(heading().getAttribute('aria-controls')).toBe(container.querySelector('.nav-section-body').id);
    expect(screen.getByRole('button', { name: 'Item one' })).toBeTruthy();
  });

  it('shows a decorative icon in the section’s accent colour', () => {
    const { container } = setup();
    const chip = container.querySelector('.nav-section-icon');
    expect(chip.getAttribute('aria-hidden')).toBe('true');
    expect(chip.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('.nav-section').style.getPropertyValue('--section-accent')).toBe('#5bbcf0');
  });

  it('can start closed', () => {
    setup({ defaultOpen: false });
    expect(heading().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Item one' })).toBeNull();
  });

  it('opens and closes when the heading is pressed', async () => {
    const { user } = setup();
    await user.click(heading());
    expect(screen.queryByRole('button', { name: 'Item one' })).toBeNull();
    await user.click(heading());
    expect(screen.getByRole('button', { name: 'Item one' })).toBeTruthy();
  });

  it('shows how many items it holds only while it is closed', async () => {
    const { user } = setup();
    expect(screen.queryByText('2')).toBeNull();
    await user.click(heading());
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('remembers the choice across visits, for each section on its own', async () => {
    const first = setup();
    await first.user.click(heading());
    first.unmount();
    setup();
    expect(heading().getAttribute('aria-expanded')).toBe('false');
    cleanup();
    setup({ id: 'other' });
    expect(heading().getAttribute('aria-expanded')).toBe('true');
  });

  it('stays open while the current page is inside it, without forgetting the saved choice', () => {
    localStorage.setItem('farmsafe_menu_section_trace', 'false');
    const forced = setup({ forceOpen: true });
    expect(screen.getByRole('button', { name: 'Item one' })).toBeTruthy();
    forced.unmount();
    setup();
    expect(screen.queryByRole('button', { name: 'Item one' })).toBeNull();
  });

  it('works without an icon or a colour', () => {
    const { container } = render(<NavGroup id="plain" label="Plain"><button type="button">Item</button></NavGroup>);
    expect(container.querySelector('.nav-section-icon')).toBeNull();
    expect(screen.getByRole('button', { name: 'Item' })).toBeTruthy();
  });
});
