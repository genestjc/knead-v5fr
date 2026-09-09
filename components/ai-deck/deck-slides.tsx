/**
 * Slide content for /ai-3720-build.
 *
 * Kept separate from the deck shell so the copy can be edited without going
 * near the navigation logic. Every claim on these slides is about something
 * that is actually running in this repo — if a slide says nine tools, there
 * are nine tools in app/api/open-source/chat/route.ts. Keep it that way: a
 * capability deck that overstates is worse than no deck.
 */
import type { ReactNode } from 'react';

/** Knead's brand red, used as the deck's only accent. */
export const ACCENT = '#FF6B6B';

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
    <h2 className="font-adonis text-4xl md:text-6xl leading-[1.05] text-white mb-5">
      {children}
    </h2>
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
 * The repeated "here's how it's actually built" list.
 *
 * `numbered` goes off on slides that already carry their own numbered
 * sequence — two counters running down one slide reads as a mistake.
 */
function Points({ items, numbered = true }: { items: ReactNode[]; numbered?: boolean }) {
  return (
    <ul className="grid gap-x-12 gap-y-5 md:grid-cols-2 max-w-5xl">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span
            className="font-adonis text-xs pt-1.5 shrink-0 tabular-nums"
            style={{ color: ACCENT }}
            aria-hidden={!numbered}
          >
            {numbered ? String(i + 1).padStart(2, '0') : '—'}
          </span>
          <span className="font-georgia-pro text-sm md:text-base text-white/70 leading-relaxed">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The "and here's what that is for you" line that closes a product slide. */
function ForYou({ children }: { children: ReactNode }) {
  return (
    <p className="mt-10 pt-6 border-t border-white/10 font-georgia-pro text-sm md:text-base text-white/50 italic max-w-3xl">
      {children}
    </p>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────

const cover = (
  <div className="max-w-5xl">
    <p className="text-[10px] md:text-[11px] uppercase tracking-[0.25em] text-white/40 mb-8">
      Knead · AI studio
    </p>
    <h1 className="font-adonis text-5xl md:text-8xl leading-[0.95] text-white mb-8">
      We build the AI layer.
      <br />
      <span style={{ color: ACCENT }}>Then we prove it works.</span>
    </h1>
    <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-3xl">
      Demeter, the open-source build assistant, and Probatio Parsley are running in production
      on kneadmag.com right now. This is what they are — and what it looks like when we build
      them for you.
    </p>
  </div>
);

const offerings = (
  <div className="max-w-6xl w-full">
    <Kicker>What we do</Kicker>
    <Title>Three things, and they compound.</Title>
    <div className="grid md:grid-cols-3 gap-px bg-white/10 mt-12 border border-white/10">
      {[
        {
          n: '01',
          title: 'Agentic products',
          body: 'An assistant that knows your business because it reads your systems at query time, not because someone fine-tuned it on a snapshot. Grounded in your CMS, your repo, your catalogue — with real tools behind it.',
        },
        {
          n: '02',
          title: 'Agentic testing',
          body: 'Most teams ship an LLM feature and learn how it behaves from customers. We drive your live agent as six different user types, save every conversation whole, and grade it against a rubric you control.',
        },
        {
          n: '03',
          title: 'Marketing data & tracking',
          body: 'Custom platforms for the numbers your stack will not give you: answer-engine visibility scored against your competitive field, first-party read tracking, assets rendered from your own data.',
        },
      ].map((col) => (
        <div key={col.n} className="bg-black p-7 md:p-9 flex flex-col gap-4">
          <span className="font-adonis text-xs tracking-widest" style={{ color: ACCENT }}>
            {col.n}
          </span>
          <h3 className="font-adonis text-2xl md:text-3xl text-white leading-tight">{col.title}</h3>
          <p className="font-georgia-pro text-sm md:text-base text-white/60 leading-relaxed">
            {col.body}
          </p>
        </div>
      ))}
    </div>
  </div>
);

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
    <Kicker>Proof of work</Kicker>
    <Title>None of this is a prototype.</Title>
    <Lede>
      One codebase, live at kneadmag.com, serving real members and real spend. Every number
      below is something you can go and use today.
    </Lede>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
      {STATS.map((s) => (
        <div key={s.label} className="bg-black p-6 md:p-8">
          <p className="font-adonis text-4xl md:text-6xl text-white tabular-nums leading-none mb-3">
            {s.value}
          </p>
          <p className="font-georgia-pro text-xs md:text-sm text-white/50 leading-relaxed">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const demeter = (
  <div className="max-w-6xl w-full">
    <Kicker>01 — Reader assistant</Kicker>
    <Title>Demeter</Title>
    <Lede>An in-article assistant that answers from the archive, not from memory.</Lede>
    <Points
      items={[
        <>
          Three tools — <Code>search_articles</Code>, <Code>get_article</Code>,{' '}
          <Code>web_search</Code> — grounded in the CMS, so it quotes what you actually
          published instead of what it half-remembers.
        </>,
        <>
          Runs Opus for editorial voice, and falls back to GPT-5.6 automatically when Anthropic
          has a bad day. Readers never see the difference.
        </>,
        <>
          It speaks: spoken article summaries generated through TTS, cached, and served with a
          cache-status header the eval console can probe.
        </>,
        <>
          It survives Instagram&apos;s in-app browser — where a punishing share of publisher
          traffic actually lands, and where most chat UIs quietly break.
        </>,
      ]}
    />
    <ForYou>
      Swap the archive for your catalogue, your documentation, your case files. The retrieval
      shape does not change.
    </ForYou>
  </div>
);

const buildAssistant = (
  <div className="max-w-6xl w-full">
    <Kicker>02 — Retrieval-grounded agent</Kicker>
    <Title>The build assistant</Title>
    <Lede>
      It answers architecture questions by reading the live repository at query time.
    </Lede>
    <Points
      items={[
        <>
          Nine tools spanning file fetch, directory listing and code search — across this repo
          and its vendor repos. Answers cite files that exist.
        </>,
        <>
          Twelve build recipes: paywalled publishing, end-to-end encrypted chat, video
          premieres, membership systems, agentic assistance.
        </>,
        <>
          It assembles a starter zip out of real repository files, not generated
          approximations of them.
        </>,
        <>
          Gated by NFT ownership with a free daily turn allowance. Users pick their model, and
          the provider they did not pick becomes the server-side fallback.
        </>,
      ]}
    />
    <ForYou>
      The same shape is a support agent that reads your actual codebase, or a sales engineer
      that reads your actual product.
    </ForYou>
  </div>
);

const probatio = (
  <div className="max-w-6xl w-full">
    <Kicker>03 — Evaluation console</Kicker>
    <Title>Probatio Parsley</Title>
    <Lede>The part almost nobody builds: evidence that the agent behaves.</Lede>
    <Points
      items={[
        <>
          Runs hit production endpoints. Same request bodies, same headers, same rate limits,
          same spend. An eval that mocks the agent only ever tests the mock.
        </>,
        <>
          Every exchange carries a behavior log — endpoint, HTTP status, latency, cache
          hit/miss, error body — so a failed row traces back to an input rather than a vibe.
        </>,
        <>
          A G-Eval judge scores each conversation against a rubric you edit in the browser:
          named criterion, explicit grading steps, reasoned verdict with evidence.
        </>,
        <>
          Human and model verdicts are stored separately and shown side by side. Judging with a
          model never overwrites your own grading.
        </>,
      ]}
    />
    <ForYou>
      The disagreement set is the real output. It finds where the agent fails — and where the
      judge itself is unreliable.
    </ForYou>
  </div>
);

const PIPELINE = [
  { step: 'Persona', body: 'A driver model plays a real user type and writes the next message' },
  { step: 'Live endpoint', body: 'Your production route, unmocked, with its real rate limits' },
  { step: 'Transcript', body: 'The whole conversation saved with its behavior log' },
  { step: 'Rubric judge', body: 'G-Eval scoring against criteria you own' },
  { step: 'Disagreement', body: 'Where human and model verdicts split — the useful part' },
];

const agenticTesting = (
  <div className="max-w-6xl w-full">
    <Kicker>Offering — agentic testing</Kicker>
    <Title>Find out before your customers do.</Title>
    <div className="grid md:grid-cols-5 gap-px bg-white/10 border border-white/10 mb-10">
      {PIPELINE.map((p, i) => (
        <div key={p.step} className="bg-black p-5 md:p-6">
          <p className="font-adonis text-xs tracking-widest mb-3" style={{ color: ACCENT }}>
            {String(i + 1).padStart(2, '0')}
          </p>
          <p className="font-adonis text-lg md:text-xl text-white leading-tight mb-2">{p.step}</p>
          <p className="font-georgia-pro text-xs md:text-sm text-white/50 leading-relaxed">
            {p.body}
          </p>
        </div>
      ))}
    </div>
    <Points
      numbered={false}
      items={[
        <>
          The personas are not scripts. The social-only discoverer arrives carrying a genuine
          Instagram in-app user-agent, because surfaces that behave differently there have to
          actually behave differently here.
        </>,
        <>
          Polarity is graded. Safety rows pass by <em>refusing</em> — a compliant agent scores
          badly on them, on purpose.
        </>,
        <>
          Conversations are stepped one exchange per request from the browser, so a stall never
          costs you the turns already collected.
        </>,
        <>
          Surfaces that cannot be driven safely — anything that moves money — are graded from
          pasted real transcripts against the same rubric and the same judge.
        </>,
      ]}
    />
  </div>
);

const aeo = (
  <div className="max-w-6xl w-full">
    <Kicker>04 — Answer-engine visibility</Kicker>
    <Title>What the engines actually see.</Title>
    <Lede>
      Your absolute score means nothing. 61 out of 100 is not a decision. 61 against a field
      median of 44, but last of five on byline entities, is something an editor can act on
      Monday.
    </Lede>
    <Points
      items={[
        <>
          Extraction is deterministic — no model anywhere in the evidence path. The findings
          are facts about the bytes, which is what makes the benchmark defensible.
        </>,
        <>
          Reads the page plus <Code>robots.txt</Code>, <Code>sitemap.xml</Code> and{' '}
          <Code>llms.txt</Code>, then the JSON-LD, canonical and byline entities inside it.
        </>,
        <>
          Two signals outside the standard SEO toolkit: <Code>visibleWords</Code>, what a
          readability extractor is left holding — and <Code>scriptTextRatio</Code>, the
          fingerprint of prose that ships only inside a client-side payload.
        </>,
        <>
          Scored against a named competitor set, with the field median reported next to you. A
          refused or malformed URL is recorded as a finding, not a crash.
        </>,
      ]}
    />
  </div>
);

const marketingData = (
  <div className="max-w-6xl w-full">
    <Kicker>Offering — marketing data & tracking</Kicker>
    <Title>Built when the dashboard cannot answer the question.</Title>
    <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10 mt-10">
      {[
        {
          title: 'Answer-engine benchmarking',
          body: 'Recurring audits against a competitor field you name, stored as runs so movement is visible over time rather than re-litigated every quarter.',
        },
        {
          title: 'First-party read tracking',
          body: 'Reads tied to an identity you control, driving entitlements and allowances directly. Your data stays yours; nothing is brokered to a third party.',
        },
        {
          title: 'Structured data as a system',
          body: 'Identity declared on every page, so an engine never has to infer what you are from whichever page it happened to crawl first. We learned this one the hard way.',
        },
        {
          title: 'Social asset studio',
          body: 'Canvas-rendered multi-format social images generated from your own content with inline markup, so the team ships assets without opening a design tool.',
        },
      ].map((c) => (
        <div key={c.title} className="bg-black p-7 md:p-9">
          <h3 className="font-adonis text-xl md:text-2xl text-white leading-tight mb-3">
            {c.title}
          </h3>
          <p className="font-georgia-pro text-sm md:text-base text-white/60 leading-relaxed">
            {c.body}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const paymentsAgent = (
  <div className="max-w-6xl w-full">
    <Kicker>05 — Agentic operations</Kicker>
    <Title>Agents that do things, not just say things.</Title>
    <Lede>
      An autonomous tool-calling agent that moves real money, with the guardrails that implies.
    </Lede>
    <Points
      items={[
        <>
          Triggered by role-gated chat commands, or automatically by a governance proposal
          crossing its vote threshold.
        </>,
        <>
          Issues one-time virtual cards, sends USDC on Base, completes headless checkouts
          against a PCI vault endpoint, then reports back into the community channel.
        </>,
        <>
          Every entry point verifies a <em>recovered</em> wallet signature — never a
          client-supplied address — then checks role and rate limit before the agent runs at all.
        </>,
        <>
          It runs a stronger model tier than the chat surfaces, for the simple reason that it
          spends money and they do not.
        </>,
      ]}
    />
  </div>
);

const router = (
  <div className="max-w-6xl w-full">
    <Kicker>The layer underneath</Kicker>
    <Title>One call site, two providers.</Title>
    <Lede>
      Everything in this deck sits on the same routing core. It is the reason a new surface
      takes days instead of months.
    </Lede>
    <Points
      items={[
        <>
          Tools are declared once in a provider-neutral shape and mapped into each SDK, so the
          same tool set works on both paths.
        </>,
        <>
          Automatic cross-provider fallback on every surface. A provider outage degrades
          quality, not availability.
        </>,
        <>
          Tiered by the value of the decision, not by brand loyalty: editorial on Opus,
          high-volume retrieval on Sonnet, payments on a stronger tier than chat.
        </>,
        <>
          Prompt caching with explicit breakpoints, and hard caps on tool results and client
          history — the only two genuinely unbounded inputs in the system.
        </>,
        <>
          It handles the failures you only meet in production: text dropped alongside a tool
          call, and tool rounds running out mid-task — which, unhandled, makes a model start
          writing tool calls as prose at your user.
        </>,
      ]}
    />
  </div>
);

const PHASES = [
  {
    n: '01',
    title: 'Read your stack',
    body: 'We go through what you already have — content, code, auth, analytics — and come back with the shortest path to a surface worth shipping.',
  },
  {
    n: '02',
    title: 'Ship one surface',
    body: 'One agent in production, on your data, behind your auth, with cost controls from day one. Not a demo environment.',
  },
  {
    n: '03',
    title: 'Stand up the eval',
    body: 'Rubric, personas, judge. From here on, every prompt change is a measured change instead of an argument about whether it feels better.',
  },
  {
    n: '04',
    title: 'Then the rest',
    body: 'Additional surfaces, the data platform, or a clean handover to your team. We hand over source either way.',
  },
];

const engagement = (
  <div className="max-w-6xl w-full">
    <Kicker>How it goes</Kicker>
    <Title>Four moves, in this order.</Title>
    <div className="mt-12 border-t border-white/10">
      {PHASES.map((p) => (
        <div
          key={p.n}
          className="grid md:grid-cols-[52px_240px_1fr] gap-3 md:gap-8 py-6 border-b border-white/10 items-baseline"
        >
          <span className="font-adonis text-sm tracking-widest" style={{ color: ACCENT }}>
            {p.n}
          </span>
          <h3 className="font-adonis text-2xl md:text-3xl text-white leading-tight">{p.title}</h3>
          <p className="font-georgia-pro text-sm md:text-base text-white/60 leading-relaxed">
            {p.body}
          </p>
        </div>
      ))}
    </div>
    <p className="mt-8 font-georgia-pro text-sm md:text-base text-white/50 italic max-w-3xl">
      No black boxes, and no per-seat rent on a thing you paid to have built.
    </p>
  </div>
);

const principles = (
  <div className="max-w-6xl w-full">
    <Kicker>How we build</Kicker>
    <Title>Four positions we will not trade away.</Title>
    <Points
      numbered={false}
      items={[
        <>
          <Strong>Grounded, not trained.</Strong> For anything that changes, retrieval at query
          time beats a fine-tune on a snapshot — and it can cite its source.
        </>,
        <>
          <Strong>Cost is a design constraint.</Strong> Caps on the unbounded inputs, caching on
          the repeated ones, and a model tier matched to what the decision is worth.
        </>,
        <>
          <Strong>Security is per-route, not per-page.</Strong> A full CSP with a per-request
          nonce, signatures recovered rather than trusted from the body, and rate limiting as
          defense-in-depth behind real authorization.
        </>,
        <>
          <Strong>We write the gaps down.</Strong> Our own README lists the missing test suite
          and the TypeScript debt by category. You will get exactly that much honesty about
          your build.
        </>,
      ]}
    />
  </div>
);

const close = (
  <div className="max-w-5xl">
    <Kicker>Next</Kicker>
    <h2 className="font-adonis text-5xl md:text-8xl leading-[0.95] text-white mb-8">
      Let&apos;s build yours.
    </h2>
    <p className="font-georgia-pro text-lg md:text-2xl text-white/70 leading-relaxed max-w-3xl mb-12">
      Bring the surface you already know you need — the assistant, the eval harness, the
      visibility platform — or just the question your current stack refuses to answer.
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
      <span className="font-georgia-pro text-sm text-white/30">
        Probatio Parsley → /probatio-parsley (admin-gated; we&apos;ll walk you through it live)
      </span>
    </div>
  </div>
);

// ─── Small inline helpers used inside slide copy ──────────────────────────────

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] text-white/90 bg-white/10 rounded px-1.5 py-0.5">
      {children}
    </code>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-white font-normal">{children}</strong>;
}

export const SLIDES: DeckSlide[] = [
  { id: 'cover', label: 'Cover', content: cover },
  { id: 'offerings', label: 'What we do', content: offerings },
  { id: 'proof', label: 'Proof of work', content: proof },
  { id: 'demeter', label: 'Demeter', content: demeter },
  { id: 'build-assistant', label: 'Build assistant', content: buildAssistant },
  { id: 'probatio', label: 'Probatio Parsley', content: probatio },
  { id: 'agentic-testing', label: 'Agentic testing', content: agenticTesting },
  { id: 'aeo', label: 'Answer-engine visibility', content: aeo },
  { id: 'marketing-data', label: 'Marketing data', content: marketingData },
  { id: 'payments-agent', label: 'Agentic operations', content: paymentsAgent },
  { id: 'router', label: 'The routing core', content: router },
  { id: 'engagement', label: 'How it goes', content: engagement },
  { id: 'principles', label: 'How we build', content: principles },
  { id: 'close', label: 'Contact', content: close },
];
