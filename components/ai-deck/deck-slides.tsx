/**
 * Slide content for /ai-3720-build — the media deck.
 *
 * Kept separate from the deck shell so the copy can be edited without going
 * near the navigation logic. Every number on these slides is checkable against
 * this repo — if a slide says nine tools, there are nine tools in
 * app/api/open-source/chat/route.ts. Keep it that way: a capability deck that
 * overstates is worse than no deck.
 *
 * The three product slides lead with a claim and then hand over to the working
 * product, so nobody has to take the claim on trust.
 *
 * The cover, Who We Are, the offerings grid and The Big Deal are identical on
 * the agency deck, so they live in deck-common.tsx. The agency variant is
 * agency-slides.tsx.
 */
import type { DemoArticle } from '@/lib/deck-demo-article';
import { DemoDemeter } from './demo-demeter';
import { DemoBuildAssistant } from './demo-build-assistant';
import { DemoProbatio } from './demo-probatio';
import {
  DemoSlide,
  Kicker,
  Lede,
  OfferingsGrid,
  Title,
  bigDeal,
  cover,
  makeClose,
  whoWeAre,
  type DeckSlide,
} from './deck-common';
import { ACCENT } from './theme';

export type { DeckSlide };

// ─── 03 · What we do ──────────────────────────────────────────────────────────

const whatWeDo = (
  <div className="max-w-6xl w-full">
    <Kicker>Knead · AI studio</Kicker>
    <Title>What We Do</Title>
    <OfferingsGrid />
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
    {
      id: 'close',
      label: 'Contact',
      content: makeClose("Let's create what tomorrow's brand experience looks like, today."),
    },
  ];
}
