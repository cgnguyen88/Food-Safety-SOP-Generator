/**
 * The top of a page: a dark navy panel laid over a photo, with the page's title on the dark side. The photo is
 * decoration (a background), so a screen reader hears only the words. `size` is "hero" for the first page and "slim"
 * for the others; `children` are buttons or links shown under the text.
 *
 * @param {{ image: string, eyebrow?: string, title: string, subtitle?: string, size?: 'hero' | 'slim', children?: import('react').ReactNode }} props
 */
export default function PhotoBanner({ image, eyebrow, title, subtitle, size = 'slim', children }) {
  return (
    <section className={`photo-banner photo-banner--${size}`} style={{ backgroundImage: `url(${image})` }}>
      <div className="photo-banner-shade" aria-hidden="true" />
      <div className="photo-banner-body">
        {eyebrow && <div className="photo-banner-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children && <div className="photo-banner-actions">{children}</div>}
      </div>
    </section>
  );
}
