// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from 'lucide-react';
import NavItem from './NavItem.jsx';

afterEach(cleanup);
const setup = (props = {}) => {
  const onClick = vi.fn();
  const user = userEvent.setup();
  render(<NavItem icon={Home} label="Dashboard" onClick={onClick} {...props} />);
  return { user, onClick };
};

describe('NavItem', () => {
  it('shows its label and calls onClick', async () => {
    const { user, onClick } = setup();
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the current page for assistive technology, and only then', () => {
    setup({ active: true });
    expect(screen.getByRole('button', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
    cleanup();
    setup({ active: false });
    expect(screen.getByRole('button', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
  });

  it('shows a count badge, capped at 99+, and nothing for zero', () => {
    setup({ badge: 3 });
    expect(within(screen.getByRole('button', { name: /^Dashboard/ })).getByText('3')).toBeTruthy();
    cleanup();
    setup({ badge: 250 });
    expect(within(screen.getByRole('button', { name: /^Dashboard/ })).getByText('99+')).toBeTruthy();
    cleanup();
    setup({ badge: 0 });
    expect(within(screen.getByRole('button', { name: /^Dashboard/ })).queryByText('0')).toBeNull();
  });

  it('works without an icon', () => {
    render(<NavItem label="Seed Log" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Seed Log' })).toBeTruthy();
  });

  it('shows the full label as a tooltip when it is long', () => {
    setup({ label: 'Purchases without OMRI listing' });
    expect(screen.getByRole('button', { name: 'Purchases without OMRI listing' }).getAttribute('title')).toBe('Purchases without OMRI listing');
  });
});
