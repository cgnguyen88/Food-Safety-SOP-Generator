// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PhotoBanner from './PhotoBanner.jsx';

afterEach(cleanup);

describe('PhotoBanner', () => {
  it('shows the title as the page’s main heading, with the eyebrow and subtitle', () => {
    render(<PhotoBanner image="/photos/produce.jpg" eyebrow="UC ANR" title="Records" subtitle="Every log on your farm." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Records' })).toBeTruthy();
    expect(screen.getByText('UC ANR')).toBeTruthy();
    expect(screen.getByText('Every log on your farm.')).toBeTruthy();
  });

  it('puts the photo behind the text as a background, so it is decoration and not content', () => {
    const { container } = render(<PhotoBanner image="/photos/produce.jpg" title="Records" />);
    expect(container.querySelector('.photo-banner').style.backgroundImage).toContain('/photos/produce.jpg');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.photo-banner-shade').getAttribute('aria-hidden')).toBe('true');
  });

  it('is the slim banner unless it is the hero', () => {
    const { container, rerender } = render(<PhotoBanner image="/a.jpg" title="One" />);
    expect(container.querySelector('.photo-banner--slim')).toBeTruthy();
    rerender(<PhotoBanner image="/a.jpg" title="One" size="hero" />);
    expect(container.querySelector('.photo-banner--hero')).toBeTruthy();
  });

  it('shows its buttons under the text, and leaves out what it was not given', () => {
    const { container, rerender } = render(<PhotoBanner image="/a.jpg" title="One"><button type="button">Set up</button></PhotoBanner>);
    expect(screen.getByRole('button', { name: 'Set up' })).toBeTruthy();
    rerender(<PhotoBanner image="/a.jpg" title="One" />);
    expect(container.querySelector('.photo-banner-actions')).toBeNull();
    expect(container.querySelector('.photo-banner-eyebrow')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });
});
