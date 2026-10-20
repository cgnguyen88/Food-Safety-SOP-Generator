// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('./components/SharedSopPage.jsx', () => ({ default: ({ token }) => <p>Worker page for {token.slice(0, 4)}</p> }));
vi.mock('./App.jsx', () => ({ default: () => <p>The signed-in app</p> }));
const { default: Root } = await import('./Root.jsx');

const TOKEN = 'e'.repeat(64);
afterEach(cleanup);

describe('Root', () => {
  it('opens the worker’s page for a SOP link', () => {
    render(<Root pathname={`/s/${TOKEN}`} />);
    expect(screen.getByText('Worker page for eeee')).toBeTruthy();
  });

  it('opens the app for everything else', async () => {
    render(<Root pathname="/" />);
    expect(await screen.findByText('The signed-in app')).toBeTruthy();
  });

  it.each([`/s/${TOKEN}/extra`, '/s/not-a-token', '/s'])('does not treat %s as a SOP link', async (pathname) => {
    render(<Root pathname={pathname} />);
    expect(await screen.findByText('The signed-in app')).toBeTruthy();
    expect(screen.queryByText(/Worker page/)).toBeNull();
  });

  it('does not load the app for a SOP link', async () => {
    render(<Root pathname={`/s/${TOKEN}`} />);
    await Promise.resolve();
    expect(screen.queryByText('The signed-in app')).toBeNull();
  });
});
