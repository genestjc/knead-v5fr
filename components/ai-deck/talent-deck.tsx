'use client';

/**
 * The deck shell for /ai-3720-build.
 *
 * Navigation is scroll-snap first, keyboard second: the browser already knows
 * how to do momentum, touch and trackpad, and every hand-rolled wheel handler
 * gets one of those wrong. Snapping is desktop-only — on a phone a slide can be
 * taller than the viewport, and mandatory snapping there fights the reader
 * instead of helping them.
 *
 * The chrome (progress bar, dot rail, counter) hides in print so ⌘P produces a
 * clean one-slide-per-page PDF; the rules live under `.deck-*` in globals.css.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { DemoArticle } from '@/lib/deck-demo-article';
import { buildSlides } from './deck-slides';
import { ACCENT } from './theme';

export function TalentDeck({ article }: { article: DemoArticle | null }) {
  // Built here rather than on the server so the only thing crossing the
  // boundary is the article's plain data, not a tree of slide elements.
  const SLIDES = useMemo(() => buildSlides(article), [article]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((target: number) => {
    const scroller = scrollerRef.current;
    const slide = slideRefs.current[target];
    if (!scroller || !slide) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ top: slide.offsetTop, behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  // Track the slide that owns the viewport. An observer beats reading
  // scrollTop on every frame, and it stays correct when a slide is taller
  // than the screen.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = slideRefs.current.indexOf(entry.target as HTMLElement);
          if (i >= 0) setIndex(i);
        }
      },
      { root: scroller, threshold: 0.5 },
    );

    for (const slide of slideRefs.current) {
      if (slide) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack the browser's own shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // The demo slides have text fields on them. Space and the arrow keys
      // belong to whoever is typing — paging the deck out from under a
      // half-written question is the fastest way to end a demo.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) {
        return;
      }

      const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
      const back = ['ArrowLeft', 'ArrowUp', 'PageUp'];

      if (forward.includes(e.key)) {
        e.preventDefault();
        goTo(Math.min(index + 1, SLIDES.length - 1));
      } else if (back.includes(e.key)) {
        e.preventDefault();
        goTo(Math.max(index - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(SLIDES.length - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, goTo, SLIDES.length]);

  const atEnd = index === SLIDES.length - 1;

  return (
    <div className="bg-black text-white">
      {/* Progress */}
      <div className="deck-chrome fixed top-0 left-0 right-0 h-[2px] bg-white/10 z-30">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${((index + 1) / SLIDES.length) * 100}%`,
            backgroundColor: ACCENT,
          }}
        />
      </div>

      {/* Wordmark */}
      <div className="deck-chrome fixed top-0 left-0 z-30 px-6 md:px-12 py-5">
        <Link
          href="/"
          className="font-adonis text-sm text-white/50 hover:text-white transition-colors"
        >
          Knead
        </Link>
      </div>

      {/* Dot rail — desktop only; the counter carries the same information on phones. */}
      <nav
        aria-label="Slides"
        className="deck-chrome hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 z-30 flex-col gap-3"
      >
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => goTo(i)}
            aria-label={`${i + 1}. ${slide.label}`}
            aria-current={i === index ? 'true' : undefined}
            className="group relative flex items-center justify-end h-3"
          >
            <span className="absolute right-5 whitespace-nowrap font-georgia-pro text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
              {slide.label}
            </span>
            <span
              className="block rounded-full transition-all duration-300"
              style={{
                width: i === index ? 7 : 5,
                height: i === index ? 7 : 5,
                backgroundColor: i === index ? ACCENT : 'rgba(255,255,255,0.25)',
              }}
            />
          </button>
        ))}
      </nav>

      {/* Slides */}
      <div
        ref={scrollerRef}
        className="deck-scroll h-[100svh] overflow-y-scroll snap-none md:snap-y md:snap-mandatory"
      >
        {SLIDES.map((slide, i) => (
          <section
            key={slide.id}
            id={slide.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            aria-label={slide.label}
            className="deck-slide relative min-h-[100svh] snap-start flex items-center px-6 md:px-20 lg:px-28 py-24 md:py-20"
          >
            {slide.content}
          </section>
        ))}
      </div>

      {/* Scrims. A slide taller than the viewport scrolls under the fixed
          chrome; without these, copy passes behind the counter and looks
          broken rather than layered. */}
      <div
        aria-hidden
        className="deck-chrome fixed top-0 left-0 right-0 h-24 z-20 pointer-events-none bg-gradient-to-b from-black to-transparent"
      />
      <div
        aria-hidden
        className="deck-chrome fixed bottom-0 left-0 right-0 h-24 z-20 pointer-events-none bg-gradient-to-t from-black to-transparent"
      />

      {/* Counter + controls */}
      <div className="deck-chrome fixed bottom-0 left-0 right-0 z-30 px-6 md:px-12 py-5 flex items-center justify-between pointer-events-none">
        <p className="font-adonis text-xs tracking-widest text-white/40 tabular-nums">
          {String(index + 1).padStart(2, '0')}
          <span className="text-white/20"> / {String(SLIDES.length).padStart(2, '0')}</span>
          <span className="hidden md:inline text-white/25"> · {SLIDES[index].label}</span>
        </p>

        <div className="flex items-center gap-2 pointer-events-auto">
          <DeckButton
            label="Previous slide"
            onClick={() => goTo(Math.max(index - 1, 0))}
            disabled={index === 0}
          >
            ←
          </DeckButton>
          <DeckButton
            label="Next slide"
            onClick={() => goTo(Math.min(index + 1, SLIDES.length - 1))}
            disabled={atEnd}
          >
            →
          </DeckButton>
        </div>
      </div>
    </div>
  );
}

function DeckButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-9 h-9 rounded-full border border-white/15 text-white/60 flex items-center justify-center text-sm hover:text-white hover:border-white/40 transition-colors disabled:opacity-20 disabled:hover:text-white/60 disabled:hover:border-white/15"
    >
      {children}
    </button>
  );
}
