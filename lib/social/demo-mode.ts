/**
 * The demo-mode flag, alone in its own module.
 *
 * It lives here rather than in require-admin.ts because the console reads it
 * to decide whether to show the bypass banner, and the console is a client
 * component. require-admin.ts pulls in verify-admin-request, which pulls in
 * viem and the service-role Supabase client — importing it from a client file
 * drags all of that into the browser bundle for the sake of one boolean.
 *
 * lib/eval/demo-mode.ts exists for exactly the same reason.
 *
 * ⚠️ Set to true ONLY for a local or gated demo. While true, /social54 and
 * every /api/social/* route skip wallet authentication entirely: anyone with
 * the URL can read the monitoring data, start analyses against your API keys,
 * and edit the competitor roster.
 *
 * It defaults to false, unlike Probatio's. Probatio's bypass exposes a rubric
 * and some transcripts; this one exposes five social credentials' worth of
 * reach, model budget, and an unpublished editorial strategy alongside drafts
 * nobody has approved.
 */
export const SOCIAL54_DEMO_MODE = false;

/** Actor recorded on runs created while auth is bypassed. */
export const DEMO_ACTOR = 'demo-mode';
