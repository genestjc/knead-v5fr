/**
 * ⚠️ TEMPORARY — DEMO MODE FOR PROBATIO PARSLEY ⚠️
 *
 * When true, /probatio-parsley and every /api/probatio/* route skip wallet
 * authentication entirely. Anyone who can reach the URL can read the rubric,
 * read saved transcripts, start agent runs (which spend Anthropic/OpenAI
 * budget against your keys), and delete runs.
 *
 * This exists so the console can be demoed without a wallet. It is NOT safe on
 * a public deployment.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  TO RESTORE AUTH: change the line below to `false`. That's the whole revert
 *  — no other file needs touching. The auth code was never removed, only
 *  bypassed.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * While this is true the console shows a persistent red banner, so a demo
 * build can't quietly become production.
 */
export const PROBATIO_DEMO_MODE = true;

/** Actor recorded on runs and verdicts created while auth is bypassed. */
export const DEMO_ACTOR = 'demo-mode';
