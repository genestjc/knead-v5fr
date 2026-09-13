/**
 * Slide content for /ai-3720-build.
 *
 * Kept separate from the deck shell so the copy can be edited without going
 * near the navigation logic. Every number on these slides is checkable against
 * this repo — if a slide says nine tools, there are nine tools in
 * app/api/open-source/chat/route.ts. Keep it that way: a capability deck that
 * overstates is worse than no deck.
 *
 * The three product slides lead with a claim and then hand over to the working
 * product, so nobody has to take the claim on trust.
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import type { DemoArticle } from '@/lib/deck-demo-article';
import { DemoDemeter } from './demo-demeter';
import { DemoBuildAssistant } from './demo-build-assistant';
import { DemoProbatio } from './demo-probatio';
import { ACCENT } from './theme';

export interface DeckSlide {
  id: string;
  /** Shown in the chrome and the dot rail tooltip. */
  label: string;
  content: ReactNode;
}

// ─── Shared slide furniture ───────────────────────────────────────────────────

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] text-white/40 mb-5">
      {children}
    </p>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-adonis text-4xl md:text-6xl leading-[1.05] text-white mb-5">{children}</h2>
  );
}

function Lede({ children }: { children: ReactNode }) {
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
function DemoSlide({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-6xl w-full">
      <Kicker>{kicker}</Kicker>
      <h2 className="font-adonis text-3xl md:text-5xl leading-[1.05] text-white mb-3">{title}</h2>
      <p className="font-georgia-pro text-base md:text-lg text-white/60 leading-relaxed max-w-3xl mb-6">
        {lede}
      </p>
      {children}
    </div>
  );
}

// ─── 01 · Cover ───────────────────────────────────────────────────────────────

const cover = (
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
      Building what's next in media experience.
    </p>
  </div>
);

// ─── 02 · Who we are ──────────────────────────────────────────────────────────

const whoWeAre = (
  <>
    {/* Full-bleed photograph behind this slide only. The slide section is
        `relative`, so this fills it edge to edge, under the type. Two darkening
        layers rather than one: the flat wash guarantees contrast anywhere on
        the frame, and the gradient keeps the left column — where the words are
        — darker still, while the right stays open enough to read as a kitchen.
        next/image rather than a CSS background: the source is a 2 MB JPEG and
        this way it ships as a sized, modern-format image. */}
    <div aria-hidden className="absolute inset-0 z-0">
      <Image
        src="/nisei-kitchen-blvck-svm.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
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

// ─── 03 · What we do ──────────────────────────────────────────────────────────

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
      'Agents for the consumer's brand experience — to help answer questions, craft social posts, or offer exclusive discounts.',
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

const whatWeDo = (
  <div className="max-w-6xl w-full">
    <Kicker>Knead · AI studio</Kicker>
    <Title>What We Do</Title>

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
  </div>
);

// ─── 04 · Proof ───────────────────────────────────────────────────────────────

const STATS: { value: string; label: string }[] = [
  { value: '86', label: 'API route handlers in production' },
  { value: '3', label: 'production LLM surfaces on one shared core' },
  { value: '2', label: 'model providers behind a single call site' },
  { value: '12', label: 'build recipes the assistant can assemble' },
  { value: '37', label: 'rubric rows grading four AI surfaces' },
  { value: '6', label: 'driver personas, one on a real Instagram WebView' },
];

const proof = (
  <div className="max-w-6xl w-full">
    <Title>Moving beyond just “vibe coding”</Title>
    <Lede>
      We use Claude, OpenAI, Tavily, and other APIs to create custom media solutions for our
      magazine.
    </Lede>

    <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
      {STATS.map((s) => (
        <div key={s.label} className="bg-black p-5 md:p-8 min-w-0">
          <p className="font-adonis text-4xl md:text-6xl text-white tabular-nums leading-none mb-3">
            {s.value}
          </p>
          <p className="font-georgia-pro text-xs md:text-sm text-white/50 leading-relaxed">
            {s.label}
          </p>
        </div>
      ))}
    </div>

    <p
      className="mt-8 font-georgia-pro text-lg md:text-2xl text-white leading-relaxed max-w-3xl border-l pl-5"
      style={{ borderColor: ACCENT }}
    >
      Every company&apos;s a media company. Here&apos;s the tools we&apos;ve built to help enhance
      ours:
    </p>
  </div>
);

// ─── 08 · The big deal ────────────────────────────────────────────────────────

const bigDeal = (
  <div className="max-w-5xl">
    <h2 className="font-adonis text-4xl md:text-7xl leading-[1.02] text-white mb-8">
      The Big Deal
    </h2>
    <p className="font-georgia-pro text-xl md:text-3xl text-white/70 leading-relaxed max-w-4xl mb-6">
      AI should create experiences, not creative.
    </p>
    <p
      className="font-adonis text-2xl md:text-4xl leading-snug max-w-3xl"
      style={{ color: ACCENT }}
    >
      Knead helps your company reach that goal.
    </p>
  </div>
);

// ─── 09 · Contact ─────────────────────────────────────────────────────────────

const close = (
  <div className="max-w-5xl">
    <h2 className="font-adonis text-5xl md:text-8xl leading-[0.95] text-white mb-8">
      Together, we can create what tomorrow's brand experience looks like, today.
    </h2>
    <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-3xl mb-12">
      Let's talk about what you want to build:
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

// ─── The deck ─────────────────────────────────────────────────────────────────

/**
 * Takes the demo article because the Demeter slide runs against a real post
 * resolved from the CMS at render time — see lib/deck-demo-article.ts.
 */
export function buildSlides(article: DemoArticle | null): DeckSlide[] {
  return [
    { id: 'cover', label: 'Cover', content: cover },
    { id: 'who-we-are', label: 'Who we are', content: whoWeAre },
    { id: 'what-we-do', label: 'What we do', content: whatWeDo },
    { id: 'proof', label: 'Beyond vibe coding', content: proof },

    {
      id: 'demeter',
      label: 'Demeter',
      content: (
        <DemoSlide
          kicker="01 — Reader assistant"
          title="Demeter"
          lede="An in-article assistant built for how people currently consume content:"
        >
          <DemoDemeter article={article} />
        </DemoSlide>
      ),
    },

    {
      id: 'build-assistant',
      label: 'Build assistant',
      content: (
        <DemoSlide
          kicker="02 — Retrieval-grounded agent"
          title="The build assistant"
          lede="Pulls code from our repo for anyone to learn from."
        >
          <DemoBuildAssistant />
        </DemoSlide>
      ),
    },

    {
      id: 'probatio',
      label: 'Probatio Parsley',
      content: (
        <DemoSlide
          kicker="03 — Evaluation console"
          title="Probatio Parsley"
          lede="Agentic testing and analytics for the modern media company."
        >
          <DemoProbatio />
        </DemoSlide>
      ),
    },

    { id: 'big-deal', label: 'The Big Deal', content: bigDeal },
    { id: 'close', label: 'Contact', content: close },
  ];
}
