/**
 * ⚠️ TEMPORARY — DEMO MODE FOR SOCIAL 54 ⚠️
 *
 * When true, /social54 and every /api/social/* route skip wallet
 * authentication entirely. Anyone who can reach the URL can read the
 * monitoring data, edit the competitor roster, and start analyses that spend
 * Anthropic/OpenAI budget against your keys.
 *
 * This is on at the team's request, matching lib/eval/demo-mode.ts so the two
 * internal consoles behave the same way while they are being shown around.
 * It is NOT safe on a public deployment.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  TO RESTORE AUTH: change the line below to `false`. That's the whole revert
 *  — no other file needs touching. The auth code was never removed, only
 *  bypassed; requireSocialAdmin still calls verifyAdminRequest underneath.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * What is actually exposed while this is true, in rough order of how much it
 * would cost you:
 *
 *   • MODEL SPEND. Sentiment, Trends, Head to Head and Composer each make an
 *     Opus/GPT call on your key. The per-route rate limits still apply, so
 *     this is bounded rather than unbounded, but it is not free.
 *   • UNPUBLISHED EDITORIAL STRATEGY. Coverage gaps, competitor analysis, and
 *     drafts nobody has approved.
 *   • THE ROSTER. Anyone can add or remove competitors.
 *
 * What is NOT exposed: the platform credentials themselves. Tokens are read
 * server-side by the connectors and never returned to the client, so demo mode
 * leaks what the tokens can SEE, not the tokens.
 *
 * While this is true the console shows a persistent red banner, so a demo
 * build can't quietly become production.
 *
 * It lives in its own module, apart from require-admin.ts, because the console
 * reads it to decide whether to show that banner and the console is a client
 * component — importing require-admin.ts there would drag viem and the
 * service-role Supabase client into the browser bundle for one boolean.
 */
export const SOCIAL54_DEMO_MODE = true;

/** Actor recorded on runs created while auth is bypassed. */
export const DEMO_ACTOR = 'demo-mode';
