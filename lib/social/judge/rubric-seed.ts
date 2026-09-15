/**
 * The starting rubric for the social judge.
 *
 * Seeded into `social_criteria` on first load, per Probatio's arrangement: an
 * empty table gets these rows, a curated one is left alone. It exists so a
 * fresh environment comes up with a real rubric rather than a blank page you
 * have to fill in before the console does anything.
 *
 * Three rules shaped what is and isn't here.
 *
 * ONLY WHAT JUDGEMENT CAN ANSWER. lib/eval/rubric-seed.ts makes this point
 * about the AEO surfaces: they have no rubric rows because they are scored
 * deterministically, and adding rows would restate a computed check in prose
 * and leave two definitions of "good" free to drift apart. Same bar here.
 * Nothing below asks about follower counts, engagement or posting time — those
 * are either computed elsewhere or, at our size, not worth computing.
 *
 * READABLE FROM THE POST ALONE. Every criterion can be answered from a caption
 * and a screenshot. That is what lets the whole console work with no API
 * credential, and it is not a compromise: craft is the part we can actually
 * change on Thursday.
 *
 * A CONCRETE BAR. Vague criteria are where LLM-as-judge scores drift — the
 * same post scores differently on Tuesday. Each `guidance` says what a pass
 * looks like specifically enough that two people would mostly agree.
 *
 * Weights are 1-3. A post that fails "the opening line does the work" has a
 * bigger problem than one that fails "hashtags are specific", and a flat score
 * would hide that.
 */
import type { SocialPlatform } from '../types';

export interface SeedCriterion {
  /** Null applies to every platform. Most of these are universal. */
  platform: SocialPlatform | null;
  prompt: string;
  guidance: string;
  expectedVerdict?: 'pass' | 'fail';
  weight?: number;
}

export const JUDGE_RUBRIC_SEED: SeedCriterion[] = [
  // ─── universal: the things that decide whether a post works anywhere ────
  {
    platform: null,
    prompt: 'Does the opening line carry a specific fact rather than announcing that we published something?',
    guidance:
      'PASS when the first sentence contains a concrete detail — a name, a date, a number, a quoted phrase, a thing that happened. FAIL for "Our new piece explores…", "We sat down with…", "New story up now", or any opening whose subject is us rather than the story. The test: could this first line have been written about any article we have ever published? If yes, it fails.',
    weight: 3,
  },
  {
    platform: null,
    prompt: 'Is there something here worth keeping — a fact a reader would screenshot, save, or repeat?',
    guidance:
      'PASS when the post contains at least one thing that has value detached from the article: a statistic, a closing date, a quote, a name worth knowing, an instruction. FAIL when the post only gestures at the article and the entire payload is behind the link. This is the single strongest driver of saves and shares, which is why it carries weight 3.',
    weight: 3,
  },
  {
    platform: null,
    prompt: 'Does every claim in the post hold up against the story it points at?',
    guidance:
      'PASS when nothing is overstated. FAIL when the post asserts something the article does not support, sharpens a hedge into a certainty, or implies exclusivity or a scoop the piece does not claim. Where the article is not supplied, judge whether the post makes claims it does not itself evidence, and say the check was partial.',
    weight: 3,
  },
  {
    platform: null,
    prompt: 'Does it sound like a person who read the piece, rather than a brand account?',
    guidance:
      'PASS for plain declarative writing with a point of view. FAIL for marketing register: "Dive in", "Don’t miss", "We explore", "🔥 NEW", rhetorical-question openings, stacked emoji, or the LinkedIn cadence of one-line paragraphs building to a platitude. Knead writes specific, unhurried and declarative — the post should read like the magazine.',
    weight: 2,
  },
  {
    platform: null,
    prompt: 'Would someone who has never heard of Knead understand what this is about?',
    guidance:
      'PASS when the post names its subject and says what happened. FAIL when it relies on knowing a previous post, an ongoing series, or an in-joke, without a clause to orient a stranger. Most people who see a post have no context.',
    weight: 2,
  },
  {
    platform: null,
    prompt: 'Does the caption use marketing language or engagement bait?',
    guidance:
      'This one is inverted: doing the thing is the FAILURE. Mark PASS only if the post DOES contain bait — "comment below", "tag a friend", "you won’t believe", manufactured urgency, or a question asked solely to farm replies. A genuine question the writer wants answered is not bait.',
    expectedVerdict: 'fail',
    weight: 2,
  },
  {
    platform: null,
    prompt: 'Is the length right for what the post is doing?',
    guidance:
      'PASS when nothing could be cut without losing something, and nothing needed is missing. FAIL for padding — throat-clearing before the point, a restated headline, a sign-off that adds nothing — or for a post so compressed the subject is unclear. Judge against the platform’s own norms, not a word count.',
    weight: 1,
  },

  // ─── Instagram: the image is half the post ───────────────────────────────
  {
    platform: 'instagram',
    prompt: 'Do the image and the caption do different work, rather than repeating each other?',
    guidance:
      'PASS when the caption says something the picture cannot — context, a date, a name, what happened next — and the image shows something the caption does not describe. FAIL when the caption narrates the image. Only judgeable when the image is supplied; return N/A on a caption alone rather than guessing.',
    weight: 3,
  },
  {
    platform: 'instagram',
    prompt: 'Does the caption stand on its own without a clickable link?',
    guidance:
      'PASS when the post is complete as read — Instagram captions carry no working link, so anything that depends on "read more" has already lost. FAIL when the payoff is behind a link. Saying "link in bio" is fine; relying on it is not.',
    weight: 2,
  },
  {
    platform: 'instagram',
    prompt: 'Are the hashtags specific enough to reach a real audience?',
    guidance:
      'PASS for roughly 5-10 tags weighted toward the specific — an artist, a venue, a movement, a city. FAIL for walls of broad tags (#art #love #photography), for fewer than about three, or for tags unrelated to the post. Broad tags put the post in a feed that moves too fast to be seen.',
    weight: 1,
  },

  // ─── X: the first line is the whole post ─────────────────────────────────
  {
    platform: 'x',
    prompt: 'Does the post give people something to add to, argue with, or quote?',
    guidance:
      'PASS when there is a claim, a finding, or an opinion someone could respond to. FAIL for a bare headline-and-link, which is read past. Reach here comes from quote-posts and replies, so a post with no surface to grab is a post with no route out of our own followers.',
    weight: 3,
  },
  {
    platform: 'x',
    prompt: 'Does the first line work as the entire post?',
    guidance:
      'PASS when the opening sentence carries the point on its own — the timeline truncates and most people read nothing else. FAIL when the point arrives in the second or third sentence, or after a thread marker.',
    weight: 3,
  },

  // ─── Farcaster: a small, technical readership that dislikes marketing ────
  {
    platform: 'farcaster',
    prompt: 'Does the cast read as a person talking, rather than an account broadcasting?',
    guidance:
      'PASS for first person, a genuine opinion, or an unexpected detail — this readership is small, technical and allergic to being marketed to. FAIL for a headline restatement or anything that reads like it was cross-posted from a brand calendar.',
    weight: 3,
  },

  // ─── Zora: the post is the thing being sold ──────────────────────────────
  {
    platform: 'zora',
    prompt: 'Is the ask honest about what someone gets for their money?',
    guidance:
      'PASS when the post says what the piece is and why it is worth holding, without inflating it. FAIL for vague collectible-speak, implied scarcity that is not real, or an ask that dresses a normal article up as an artefact. Collecting costs money, and this is the only paid action in the console.',
    weight: 3,
  },

  // ─── LinkedIn: the argument, not the announcement ────────────────────────
  {
    platform: 'linkedin',
    prompt: 'Is there an argument about the industry, with the story as its evidence?',
    guidance:
      'PASS when the post makes a claim about the trade and uses the piece to support it. FAIL when it only announces that we published something. This audience is press, partnerships and the trade; an announcement gives them no reason to engage.',
    weight: 3,
  },
  {
    platform: 'linkedin',
    prompt: 'Do the first two lines survive the "see more" cut?',
    guidance:
      'PASS when the opening two lines contain the claim. FAIL when they are throat-clearing and the substance sits below the fold — almost nobody expands.',
    weight: 2,
  },
];
