/**
 * Pieces shared by both decks — /ai-3720-build (media) and /ai-3720-agency.
 *
 * ⚠ Copy in this file appears on BOTH decks. The cover, Who We Are and The Big
 * Deal are identical on each, so they live here; editing a word here changes
 * both pages. Anything a deck says on its own terms belongs in its own file:
 * deck-slides.tsx for media, agency-slides.tsx for agencies.
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import { ACCENT } from './theme';

export interface DeckSlide {
  id: string;
  /** Shown in the chrome and the dot rail tooltip. */
  label: string;
  content: ReactNode;
  /**
   * Drop the slide's padding and let the content fill the screen. For a slide
   * that is a product rather than a page about one.
   */
  bleed?: boolean;
}

// ─── Slide furniture ──────────────────────────────────────────────────────────

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] text-white/40 mb-5">
      {children}
    </p>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-adonis text-4xl md:text-6xl leading-[1.05] text-white mb-5">{children}</h2>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-3xl mb-10">
      {children}
    </p>
  );
}

/**
 * A slide whose point is the working thing on it, so the words get out of the
 * way: smaller heading, one line of setup, then the product.
 */
export function DemoSlide({
  kicker,
  title,
  lede,
  note,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  /** A second, quieter line under the lede. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-6xl w-full">
      <Kicker>{kicker}</Kicker>
      <h2 className="font-adonis text-3xl md:text-5xl leading-[1.05] text-white mb-3">{title}</h2>
      <p className="font-georgia-pro text-base md:text-lg text-white/60 leading-relaxed max-w-3xl">
        {lede}
      </p>
      {note && (
        <p className="mt-2 font-georgia-pro text-sm md:text-base text-white/40 leading-relaxed max-w-3xl">
          {note}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

// ─── Cover ────────────────────────────────────────────────────────────────────

export const cover = (
  <div className="max-w-5xl">
    <p className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] text-white/40 mb-8">
      Knead
    </p>
    <h1 className="font-adonis text-5xl md:text-8xl leading-[0.95] text-white mb-8">
      AI Products
      <br />
      <span style={{ color: ACCENT }}>+ Strategy</span>
    </h1>
    <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-3xl">
      Building what&apos;s next in media experience.
    </p>
  </div>
);

// ─── Who we are ───────────────────────────────────────────────────────────────

export const whoWeAre = (
  <>
    {/* Full-bleed photograph behind this slide only. The slide section is
        `relative`, so this fills it edge to edge, under the type. Two darkening
        layers rather than one: the flat wash guarantees contrast anywhere on
        the frame, and the gradient keeps the left column — where the words are
        — darker still, while the right stays open enough to read as a kitchen.
        next/image rather than a CSS background: the source is a 2 MB JPEG and
        this way it ships as a sized, modern-format image. */}
    <div aria-hidden className="absolute inset-0 z-0">
      <Image src="/nisei-kitchen-blvck-svm.jpg" alt="" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/25" />
    </div>

    <div className="relative z-10 max-w-5xl w-full">
      <Kicker>Knead</Kicker>
      <Title>Who We Are</Title>

      <div className="space-y-7 max-w-3xl">
        <p className="font-georgia-pro text-lg md:text-xl text-white/75 leading-relaxed">
          Knead&apos;s a magazine that covers art, food, music, technology, fashion, and other
          creative disciplines.
        </p>

        <p className="font-georgia-pro text-lg md:text-xl text-white/75 leading-relaxed">
          Our interviews include notable names such as{' '}
          <span className="text-white">
            Daniel Arsham, LVMH, AMBUSH, Constant Practice, Nina Chanel Abney, Richard Nadler, Dr.
            Gigi Casimiro
          </span>
          , and others.
        </p>

        <p
          className="font-georgia-pro text-lg md:text-xl text-white leading-relaxed border-l pl-5"
          style={{ borderColor: ACCENT }}
        >
          Our platform uses AI to enhance the reader experience, not write stories or design slop.
        </p>
      </div>
    </div>
  </>
);

// ─── What we do ───────────────────────────────────────────────────────────────

interface Offering {
  n: string;
  title: string;
  subtitle?: string;
  points: string[];
}

const OFFERINGS: Offering[] = [
  {
    n: '01',
    title: 'Agentic Products',
    points: [
      'Agents for the brand experience — to help answer questions, craft social posts, or offer exclusive discounts.',
      'Agents for your team to ask questions — pulled directly from your documentation, vendors, or repo.',
      'Voice summaries and conversational experiences.',
    ],
  },
  {
    n: '02',
    title: 'Agentic Testing',
    subtitle: 'Putting agents to work faster, in more places than a human team can.',
    points: [
      "Having agents simulate every device and app where a brand is found; for example, a Gen-Z user going through the whole sign-up process in Instagram's in-app browser.",
      'Simulating users not readily within reach, such as less tech-savvy generations.',
      'Running agents across your live socials and media assets to summarize audience sentiment (LLM-as-judge).',
    ],
  },
  {
    n: '03',
    title: 'Data, Analytics, & Operations',
    points: [
      'Aggregating data into custom dashboards.',
      'Using AI to synthesize results and provide insights from targeted research.',
      'Creating workflows that help improve efficiency and accuracy.',
    ],
  },
];

/** The three-column offerings grid. Both decks show it; only the words above it differ. */
export function OfferingsGrid() {
  return (
    <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 mt-8">
      {OFFERINGS.map((col) => (
        <div key={col.n} className="bg-black p-6 md:p-7 flex flex-col gap-4 min-w-0">
          <span className="font-adonis text-xs tracking-widest" style={{ color: ACCENT }}>
            {col.n}
          </span>

          {/* Fixed header height across the three columns so the bullet lists
              start on the same line — only the middle column has a subtitle. */}
          <div className="md:min-h-[104px]">
            <h3 className="font-adonis text-2xl md:text-[28px] text-white leading-tight">
              {col.title}
            </h3>
            {col.subtitle && (
              <p className="mt-2 font-georgia-pro text-sm text-white/50 italic leading-relaxed">
                {col.subtitle}
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {col.points.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span aria-hidden className="text-white/25 select-none">
                  —
                </span>
                <span className="font-georgia-pro text-sm md:text-[15px] text-white/60 leading-relaxed">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── The big deal ─────────────────────────────────────────────────────────────

export const bigDeal = (
  <div className="max-w-5xl">
    <h2 className="font-adonis text-4xl md:text-7xl leading-[1.02] text-white mb-8">The Big Deal</h2>
    <p className="font-georgia-pro text-xl md:text-3xl text-white/70 leading-relaxed max-w-4xl mb-6">
      AI should create experiences, not creative.
    </p>
    <p className="font-adonis text-2xl md:text-4xl leading-snug max-w-3xl" style={{ color: ACCENT }}>
      Instead, it should empower people to learn and share faster. Knead can help you get there.
    </p>
  </div>
);

// ─── Contact ──────────────────────────────────────────────────────────────────

/** Identical on both decks but for the headline, which each one supplies. */
export function makeClose(heading: string) {
  return (
    <div className="max-w-5xl">
      <h2 className="font-adonis text-4xl md:text-6xl leading-[1.05] text-white mb-8">{heading}</h2>
      <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-3xl mb-12">
        Want to talk about what you&apos;d like to build?
      </p>
      <a
        href="mailto:joe@kneadmag.com"
        className="inline-block font-adonis text-2xl md:text-4xl text-white border-b-2 pb-3 transition-colors hover:text-white/60"
        style={{ borderColor: ACCENT }}
      >
        joe@kneadmag.com
      </a>
      <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap gap-x-8 gap-y-3">
        <a
          href="/open-source"
          className="font-georgia-pro text-sm text-white/50 hover:text-white transition-colors"
        >
          Try the build assistant → /open-source
        </a>
        <a
          href="/probatio-parsley"
          className="font-georgia-pro text-sm text-white/50 hover:text-white transition-colors"
        >
          Probatio Parsley → /probatio-parsley
        </a>
      </div>
    </div>
  );
}
