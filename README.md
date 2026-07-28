# Knead

Independent digital magazine and membership platform, live at **[kneadmag.com](https://kneadmag.com)**.

Knead publishes long-form creative journalism behind a membership model, and runs an
encrypted community chat, live video events, and contributor payouts alongside it. Most of
what's interesting in this repo is the AI layer built on top: three production LLM surfaces
sharing one provider-neutral routing core.

Next.js 14 (App Router) · TypeScript · Sanity CMS · Supabase · Stripe · Base L2 · Vercel

---

## The AI layer

Three surfaces, one shared core. All of them run in production against real users.

### `lib/ai/router.ts` — provider-neutral model routing

The piece everything else sits on. It runs a tool-calling chat loop against **either**
Anthropic or OpenAI from a single call site:

- **Tools are declared once** in a provider-neutral shape and mapped into each SDK's format,
  so the same tool set works on both paths.
- **Automatic cross-provider fallback.** Every surface names a primary and gets the other
  provider free. A Claude outage degrades quality, not availability.
- **Tiered routing by decision value, not by provider.** Editorial surfaces run Opus;
  the high-volume retrieval-grounded build assistant runs Sonnet; the payments agent runs a
  stronger tier than the chat surfaces because it moves real money. Each fallback tier is
  matched to the surface it covers so quality holds through an outage.
- **Prompt caching** with explicit breakpoints on the system prompt, the tool block, and the
  growing conversation prefix.
- **Bounded cost.** Tool results and client history are the only unbounded inputs, so both
  are capped.

It also handles the failure modes you only find in production — text emitted alongside a tool
call getting dropped, and tool rounds running out mid-task (which, unhandled, makes the model
start writing tool calls as literal prose at the user).

### Demeter — reader assistant (`app/api/demeter/*`)

An in-article assistant grounded in the Sanity CMS. Tools: `search_articles`, `get_article`,
and `web_search`. Also generates spoken article summaries via TTS. Runs on Opus for editorial
voice.

### Build assistant (`app/api/open-source/*`)

The most involved surface. A retrieval-grounded agent that answers architecture questions by
fetching **live source files from this repo and its vendor repos** at query time — nine tools
spanning file fetch, directory listing, and code search across both. It works from twelve
"build recipes" (paywalled blog, E2E-encrypted chat, video premieres, agentic assistance…),
can assemble a starter zip from real repo files, and is gated by NFT ownership with a
free-tier daily turn limit. Users pick their model; the unpicked provider becomes the
server-side fallback.

### Payments agent (`lib/agent.ts`, `app/api/agent/*`)

An autonomous tool-calling agent triggered by role-gated chat commands or by governance
proposals crossing a vote threshold. It issues one-time virtual cards, sends USDC on Base,
completes headless Shopify checkouts against the PCI vault endpoint, and reports back into
the community channel. Every entry point verifies a **recovered wallet signature** — never a
client-supplied address — then checks role and rate limit before the agent runs.

### Validation

`scripts/smoke-gpt-5-6.ts` is a live smoke test for the GPT-5.6 migration. Beyond exercising
both tool-loop shapes end to end, it includes a **constraint probe** that asserts a known API
limitation still holds — documenting why the router is built the way it is, and signalling
when that workaround can be removed. Typechecking proves the code compiles; this proves the
loops actually complete.

---

## Everything else

**Publishing** — Sanity CMS with embedded Studio at `/studio`, portable-text rendering,
audio Q&A blocks for voice-recorded interviews, Mux video.

**Membership** — Stripe Elements checkout and webhooks, NFT-gated premium tiers on Base,
paywall with free-article allowance.

**Community** — end-to-end encrypted group chat on Towns Protocol, direct messages, live
video events via Daily, reactions, announcements, and on-chain governance proposals.
Because Towns keys live only on member devices, a **headless key sharer** runs as an
always-on bot member so new joiners can decrypt history (`server/key-sharer.ts`).

**Contributor economy** — contributor NFTs, weighted USDC pool distribution, allowances, and
proposal-triggered payouts, driven by three Vercel crons (`vercel.json`) behind `CRON_SECRET`.

**Operations** — admin console for contributors, events, mailing, and announcements, plus a
canvas-based Social Asset Studio that renders multi-format social images with inline markup.

### Security

- Full **CSP with a per-request nonce** in `middleware.ts`.
- **Wallet-signature auth** on privileged routes; the signer is always recovered, never trusted
  from the request body.
- **Rate limiting** (`lib/rate-limit.ts`) — Upstash-backed with a per-instance in-memory
  fallback, dependency-free. Deliberately **fail-open**: per-route auth is the primary control,
  this is defense-in-depth against volumetric abuse (gas drain, LLM spend).

---

## Running locally

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # then fill in the values
npm run dev
```

Sanity, Supabase, Stripe, Thirdweb, and at least one LLM key are needed for a useful local
run; see `.env.example` for the full list and which subsystem each variable belongs to.

```
app/api/        83 route handlers
app/            pages (App Router)
lib/ai/         provider-neutral model routing
lib/agent.ts    autonomous payments agent
lib/github.ts   retrieval tools for the build assistant
lib/blockchain/ Base L2 contract reads/writes
server/         long-lived processes (key sharer, agent runner)
scripts/        operational + validation scripts
```

---

## Known gaps

Being straight about the state of things:

- **No automated test suite.** `scripts/smoke-gpt-5-6.ts` is the only validation harness. This
  is the biggest gap.
- **No CI.** Checks are run locally before merge.
- **~168 TypeScript errors**, so `next.config.mjs` currently sets `ignoreBuildErrors` to keep
  deploys unblocked. Roughly a third clear with a `target: ES2020` bump; the rest are mostly
  thirdweb transaction generics and Stripe API version drift. Being paid down.
- Several components have grown too large (`app/chat/connected-chat.tsx` is the worst offender)
  and want decomposition.
- File naming is inconsistent between kebab-case and PascalCase at the `components/` root.
