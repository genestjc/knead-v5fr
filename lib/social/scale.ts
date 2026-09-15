/**
 * Is this comparison meaningful at these audience sizes?
 *
 * The first version of this console compared us to the field on engagement
 * rate and stopped there. Rate is the right correction when two accounts are
 * within shouting distance of each other — it stops the bigger list winning
 * automatically. It is the WRONG correction across a large gap, and it fails
 * in the flattering direction, which is the dangerous one.
 *
 * Two things go wrong at a few hundred followers:
 *
 *   1. Small accounts post structurally higher engagement rates than large
 *      ones. It is mostly a property of how feeds distribute, not of quality.
 *      An account with 300 engaged readers can sit at 4% while a national
 *      title with 300,000 sits at 0.3%. Reported as "we beat the field by 3.7
 *      points", that is arithmetically true and strategically worthless — it
 *      would have us conclude we are winning for as long as we stay small.
 *
 *   2. The rate itself is unstable. At 300 followers, three likes is one
 *      point of engagement rate. Ordinary variation between two posts swamps
 *      any real signal, and a median over five posts does not fix it.
 *
 * So this module decides whether a rate comparison is allowed to become a
 * verdict. When it isn't, the console says so and points at what IS
 * informative at this size — our own trajectory, and what the field is
 * covering — rather than printing a number nobody should act on.
 *
 * What this deliberately does NOT do is hide competitor data. Their cadence,
 * formats, subjects and captions are useful at any size gap; it is only the
 * head-to-head scoreboard that stops meaning anything.
 */

/**
 * Below this, engagement rate is too jumpy to read as a measurement.
 *
 * Chosen so that one extra like moves the rate by less than a tenth of a
 * point: at 2,000 followers a single like is 0.05%. Under it, single
 * interactions start visibly moving the number.
 */
export const SMALL_ACCOUNT_FOLLOWERS = 2_000;

/**
 * How much bigger the field has to be before rate stops being comparable.
 *
 * An order of magnitude. Within 10× the structural rate advantage is small
 * enough to argue with; beyond it, the comparison is measuring account size
 * through a different lens rather than correcting for it.
 */
export const MEANINGFUL_GAP_RATIO = 10;

export type ComparabilityVerdict =
  /** Both sides are close enough in size that rate means something. */
  | 'comparable'
  /** Our audience is too small for rate to be stable. */
  | 'too-small'
  /** Both sides are readable, but the field is an order of magnitude bigger. */
  | 'scale-gap'
  /** Follower counts are missing, so nothing can be said. */
  | 'unknown';

export interface Comparability {
  verdict: ComparabilityVerdict;
  /** Whether a rate delta may be presented as a finding. */
  rateIsMeaningful: boolean;
  ourFollowers: number | null;
  /** Median of the competitors' follower counts. */
  fieldFollowers: number | null;
  /** How many times larger the field is. Null when either side is unknown. */
  gapRatio: number | null;
  /** One sentence, written for both the console and the agent prompts. */
  explanation: string;
}

function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function assessComparability(
  ourFollowers: number | null,
  competitorFollowers: (number | null)[],
): Comparability {
  const field = median(competitorFollowers.filter((f): f is number => typeof f === 'number'));

  const base: Omit<Comparability, 'verdict' | 'rateIsMeaningful' | 'explanation'> = {
    ourFollowers,
    fieldFollowers: field,
    gapRatio:
      ourFollowers && ourFollowers > 0 && field !== null
        ? Number((field / ourFollowers).toFixed(1))
        : null,
  };

  if (!ourFollowers || ourFollowers <= 0) {
    return {
      ...base,
      verdict: 'unknown',
      rateIsMeaningful: false,
      explanation:
        'Our follower count is unknown here, so engagement rate cannot be computed and no comparison against the field is possible.',
    };
  }

  const tooSmall = ourFollowers < SMALL_ACCOUNT_FOLLOWERS;
  const bigGap = base.gapRatio !== null && base.gapRatio >= MEANINGFUL_GAP_RATIO;

  if (tooSmall) {
    // Stated in the concrete terms of this account, because "the sample is
    // small" is easy to nod at and ignore. One like being a fifth of a point
    // is not.
    const pointsPerLike = (100 / ourFollowers).toFixed(2);
    return {
      ...base,
      verdict: 'too-small',
      rateIsMeaningful: false,
      explanation:
        `At ${ourFollowers.toLocaleString()} followers one interaction is ${pointsPerLike} points of engagement rate, so the rate moves more on ordinary variation than on anything we did. ` +
        (bigGap
          ? `The field is about ${base.gapRatio}× our size, and small accounts structurally out-rate large ones — a rate win here measures our size, not our work. `
          : '') +
        'Read our own trajectory over time and what the field is covering; do not read a rate delta as a verdict.',
    };
  }

  if (bigGap) {
    return {
      ...base,
      verdict: 'scale-gap',
      rateIsMeaningful: false,
      explanation:
        `The field is about ${base.gapRatio}× our size here (${base.fieldFollowers?.toLocaleString()} against our ${ourFollowers.toLocaleString()}). ` +
        'Small accounts structurally out-rate large ones, so a rate advantage at this gap reflects the size difference rather than performance. ' +
        'Their cadence, formats and subject choices are still informative; the scoreboard is not.',
    };
  }

  return {
    ...base,
    verdict: 'comparable',
    rateIsMeaningful: true,
    explanation:
      base.gapRatio !== null
        ? `Our audience and the field's are within ${base.gapRatio}× of each other, so engagement rate is a fair comparison.`
        : 'Engagement rate is a fair comparison here.',
  };
}

/**
 * The instruction block handed to every agent that sees competitor numbers.
 *
 * Written as a rule rather than as data. A model given "our followers: 312,
 * their followers: 340,000" and told to compare on rate will do exactly that
 * and report a win — the arithmetic is easy and the conclusion is wrong. It
 * has to be told not to.
 */
export function renderComparabilityRules(assessments: Comparability[]): string {
  const blocked = assessments.filter((a) => !a.rateIsMeaningful);

  if (blocked.length === 0) {
    return [
      'AUDIENCE SCALE',
      '  Our audience and the field’s are close enough in size that engagement rate is a fair comparison on every platform here.',
      '',
    ].join('\n');
  }

  return [
    'AUDIENCE SCALE — read this before making any comparative claim.',
    '',
    ...blocked.map((a) => `  • ${a.explanation}`),
    '',
    '  On the platforms above you MUST NOT report that we beat, lead, outperform or',
    '  are ahead of the field on engagement rate, however favourable the numbers look.',
    '  Small accounts out-rate large ones as a matter of course; saying we win on rate',
    '  at this size gap is reporting our follower count back to us as an achievement.',
    '',
    '  What you may do with competitor data instead, and should:',
    '    - Their SUBJECTS: what they covered that we did not. This is the most useful',
    '      thing you can produce at our size and does not depend on our numbers.',
    '    - Their FORMATS and CADENCE: what shape their posts take, how often they run.',
    '    - Their CRAFT: how a caption opens, what it leads with, what it quotes.',
    '  And with our own data: our trajectory against OUR OWN past, not against theirs.',
    '',
  ].join('\n');
}
