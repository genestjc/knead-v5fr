'use client';

/**
 * A line of text scaled to exactly fill its container's width.
 *
 * The cover title has to span the page, and no font size written by hand can
 * promise that: the deck is read at anything from a laptop to a 5K display,
 * and `adonis-web` arrives from Typekit *after* first paint, so a size tuned
 * against the fallback serif is wrong the moment the real font lands. So
 * measure instead — at a reference size, then scale to the container.
 *
 * Refits on resize and once the webfont is ready, and again before printing,
 * where the page box is a different width from the screen.
 *
 * Below `minWidth` it renders as plain text at whatever size the classes give
 * it: filling the width on a phone means two words pulled apart across 350px,
 * which reads as a mistake rather than a masthead.
 *
 * Sizing is applied straight to the node rather than held in React state. The
 * measurement has to write a reference size to the element, and with state
 * that write is only undone by a re-render — so a second fit that computed the
 * same size would leave the element stuck at the reference. Writing the result
 * immediately makes each fit self-contained.
 */
import { useCallback, useEffect, useRef } from 'react';

/** Measured at this size, then scaled — big enough to keep rounding error small. */
const REFERENCE_PX = 100;

export function FitText({
  children,
  className = '',
  style,
  minWidth = 1024,
  lineHeight = 0.86,
}: {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  /** Viewport width at or above which the text is fitted. */
  minWidth?: number;
  lineHeight?: number;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const span = spanRef.current;
    const container = span?.parentElement;
    if (!span || !container) return;

    if (window.innerWidth < minWidth) {
      span.style.fontSize = '';
      span.style.lineHeight = '';
      return;
    }

    span.style.fontSize = `${REFERENCE_PX}px`;
    const natural = span.scrollWidth;
    if (!natural) return;

    span.style.fontSize = `${(REFERENCE_PX * container.clientWidth) / natural}px`;
    span.style.lineHeight = String(lineHeight);
  }, [minWidth, lineHeight]);

  useEffect(() => {
    fit();

    // Watches the container, whose width is what the fit depends on. Resizing
    // the text changes this element's height, never the container's width, so
    // there is no feedback loop to guard against.
    const observer = new ResizeObserver(fit);
    if (spanRef.current?.parentElement) observer.observe(spanRef.current.parentElement);

    // The fitted size is wrong until the real font is in.
    document.fonts?.ready.then(fit).catch(() => {});
    window.addEventListener('beforeprint', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('beforeprint', fit);
    };
  }, [fit]);

  // No clipping on the wrapper: a line height under 1 makes the line box
  // shorter than the glyphs, so descenders sit outside it — `overflow: hidden`
  // would shear the tail off a "g" or a "y". Nothing can overflow horizontally
  // anyway, since the size is derived from the container's own width.
  return (
    <span className="block">
      <span ref={spanRef} className={`inline-block whitespace-nowrap ${className}`} style={style}>
        {children}
      </span>
    </span>
  );
}
