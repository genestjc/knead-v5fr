/**
 * Slide content for /ai-3720-agency — the agency deck.
 *
 * Same products as the media deck at /ai-3720-build, ordered and worded for a
 * different room. Probatio leads: agencies buy testing and analytics capacity
 * before they buy a reader assistant, so it comes first and gets the whole
 * screen, and the other two follow as proof the same team builds products.
 *
 * Slides identical on both decks (cover, Who We Are, the offerings grid, The
 * Big Deal, the contact page) come from deck-common.tsx.
 */
import type { ReactNode } from 'react';
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

// ─── 03 · What we do ──────────────────────────────────────────────────────────

const whatWeDo = (
  <div className="max-w-6xl w-full">
    <Kicker>Knead · AI studio</Kicker>
    <Title>What We Do</Title>
    <Lede>We help build agentic solutions for agencies to get more done.</Lede>
    <OfferingsGrid />
  </div>
);

// ─── 04 · The problems we solve ───────────────────────────────────────────────

/**
 * Said in the words an agency would actually use, because a list of
 * capabilities is easy to nod along to and hard to recognise yourself in.
 */
const PROBLEMS: ReactNode[] = [
  <>
    I wish we could test several demographics over different in-app browsers without hiring a focus
    group.
  </>,
  <>
    Our development team is tired of answering everyone&apos;s questions, it&apos;d be great if we
    had <span className="text-white/90">&lsquo;a ChatGPT just for our business&rsquo;</span>.
  </>,
  <>
    It&apos;d be nice to take all the APIs for our data tracking and put them in one dashboard, but
    we&apos;d need a developer.
  </>,
  <>
    We&apos;re looking for new insights on how our social and SEO/AEO is performing against the
    competition.
  </>,
];

const problems = (
  <div className="max-w-6xl w-full">
    <Title>The Problems We Solve</Title>
    <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-4xl mb-8">
      We use Claude, OpenAI, Tavily, and other APIs to create solutions that fill in your
      agency&apos;s gaps. A few example problems:
    </p>

    <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
      {PROBLEMS.map((problem, i) => (
        <div key={i} className="bg-black p-6 md:p-7 flex gap-4 min-w-0">
          <span
            aria-hidden
            className="font-adonis text-3xl leading-none shrink-0 select-none"
            style={{ color: ACCENT }}
          >
            &ldquo;
          </span>
          <p className="font-georgia-pro text-base md:text-lg text-white/70 leading-relaxed italic">
            {problem}
          </p>
        </div>
      ))}
    </div>
  </div>
);

// ─── 05 · Probatio, full screen ───────────────────────────────────────────────

/**
 * The flagship slide. Everything above the console is trimmed to a header
 * strip so the product itself gets the rest of the screen, on a phone as much
 * as a laptop.
 *
 * The padding here does the work the slide's own padding usually does: it
 * clears the fixed wordmark at the top, the counter at the bottom, and the dot
 * rail down the right on desktop.
 */
const probatioFullScreen = (
  <div className="deck-bleed flex flex-col h-[100svh] w-full pt-16 pb-16 md:pt-20 md:pb-14">
    {/* Deliberately tight: every line here is height the console doesn't get. */}
    <div className="shrink-0 px-6 md:px-12 pb-3">
      <p className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] text-white/40 mb-1.5">
        01 — Evaluation console
      </p>
      <h2 className="font-adonis text-3xl md:text-4xl leading-[1.05] text-white mb-1.5">
        Probatio Parsley
      </h2>
      <p className="font-georgia-pro text-base md:text-lg text-white/60 leading-snug">
        Agentic testing and analytics for the modern agency.
      </p>
      <p className="font-georgia-pro text-sm md:text-base text-white/40 leading-snug">
        Use agents to simulate users, cross-compare competition, analyze data, or test products.
      </p>
    </div>

    <div className="flex-1 min-h-0 px-0 md:pl-12 md:pr-20">
      <DemoProbatio fullBleed />
    </div>
  </div>
);

// ─── The deck ─────────────────────────────────────────────────────────────────

/**
 * Takes the demo article because the Demeter slide runs against a real post
 * resolved from the CMS at render time — see lib/deck-demo-article.ts.
 */
export function buildAgencySlides(article: DemoArticle | null): DeckSlide[] {
  return [
    { id: 'cover', label: 'Cover', content: cover },
    { id: 'who-we-are', label: 'Who we are', content: whoWeAre },
    { id: 'what-we-do', label: 'What we do', content: whatWeDo },
    { id: 'problems', label: 'Problems we solve', content: problems },

    {
      id: 'probatio',
      label: 'Probatio Parsley',
      content: probatioFullScreen,
      bleed: true,
    },

    {
      id: 'demeter',
      label: 'Demeter',
      content: (
        <DemoSlide
          kicker="02 — Reader assistant"
          title="Demeter"
          lede="Our in-article assistant for content consumption — create your own to build an in-house agent."
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
          kicker="03 — Retrieval-grounded agent"
          title="The build assistant"
          lede="Create an agent to teach your team or clients whatever you want."
        >
          <DemoBuildAssistant
            question="What do you want to learn?"
            note="This demo pulls from Knead's repo to teach anyone how to build from our stack."
          />
        </DemoSlide>
      ),
    },

    { id: 'big-deal', label: 'The Big Deal', content: bigDeal },
    {
      id: 'close',
      label: 'Contact',
      content: makeClose("Let's create what tomorrow's agency experience looks like, today"),
    },
  ];
}
