/**
 * The deterministic half of trend analysis.
 *
 * Everything in this file is arithmetic over collected posts, and it runs
 * before any model sees the data. That ordering is the point: cadence,
 * movement and format mix are facts, and a model asked to eyeball them from a
 * list of posts will approximate them — plausibly, and wrongly, and with the
 * same confident tone it uses for things it got right.
 *
 * So the agent is handed computed numbers and asked to do the part that
 * actually needs judgment: what the numbers mean, and what to do. The split
 * also makes the output checkable — every figure in a trend report traces to a
 * function here rather than to a model's arithmetic.
 */
import {
  comparableFields,
  compactNumber,
  groupByAccount,
  median,
  movement,
  summarizeAccount,
  tagFrequency,
  totalOn,
  type AccountSummary,
  type Movement,
} from './metrics';
import { platformLabel, type MediaType, type SocialPlatform, type SocialPost } from './types';

export interface FormatMix {
  mediaType: MediaType;
  posts: number;
  share: number;
  medianEngagement: number | null;
}

export interface FieldAccount extends AccountSummary {
  movement: Movement;
  formatMix: FormatMix[];
}

export interface PlatformField {
  platform: SocialPlatform;
  ours: FieldAccount | null;
  competitors: FieldAccount[];
  /** Median of the competitors' medians — the number ours is actually measured against. */
  fieldMedianEngagement: number | null;
  fieldMedianRate: number | null;
  /**
   * Metrics every account on this platform reports. Any comparison below is
   * computed on these fields only — see lib/social/metrics.ts.
   */
  comparableOn: string[];
  /**
   * Set when the platform cannot support a fair comparison, e.g. LinkedIn,
   * where only our own posts are readable. The agent is told not to rank here.
   */
  comparisonBlocked: string | null;
}

export interface TagDelta {
  tag: string;
  oursCount: number;
  theirsCount: number;
}

export interface FieldStats {
  windowDays: number;
  platforms: PlatformField[];
  /** Tags the field uses that we don't, and vice versa. */
  tagDeltas: TagDelta[];
  totals: { ourPosts: number; competitorPosts: number; accounts: number };
}

function formatMix(posts: SocialPost[]): FormatMix[] {
  const fields = comparableFields(posts);
  const byType = new Map<MediaType, SocialPost[]>();
  for (const post of posts) {
    const bucket = byType.get(post.mediaType);
    if (bucket) bucket.push(post);
    else byType.set(post.mediaType, [post]);
  }
  return [...byType.entries()]
    .map(([mediaType, subset]) => ({
      mediaType,
      posts: subset.length,
      share: Number((subset.length / posts.length).toFixed(2)),
      medianEngagement: median(
        subset.map((p) => totalOn(p, fields)).filter((v): v is number => v !== null),
      ),
    }))
    .sort((a, b) => b.posts - a.posts);
}

function toFieldAccount(posts: SocialPost[], windowDays: number): FieldAccount | null {
  const summary = summarizeAccount(posts, windowDays);
  if (!summary) return null;
  return { ...summary, movement: movement(posts, windowDays), formatMix: formatMix(posts) };
}

export function computeFieldStats(posts: SocialPost[], windowDays: number): FieldStats {
  const byPlatform = new Map<SocialPlatform, SocialPost[]>();
  for (const post of posts) {
    const bucket = byPlatform.get(post.platform);
    if (bucket) bucket.push(post);
    else byPlatform.set(post.platform, [post]);
  }

  const platforms: PlatformField[] = [];

  for (const [platform, platformPosts] of byPlatform) {
    const accounts = [...groupByAccount(platformPosts).values()]
      .map((group) => toFieldAccount(group, windowDays))
      .filter((a): a is FieldAccount => a !== null);

    const ours = accounts.find((a) => a.isOurs) ?? null;
    const competitors = accounts.filter((a) => !a.isOurs);

    // The ruler both sides are measured with. Computed across ALL of this
    // platform's posts so ours and theirs are scored identically — see the
    // header of lib/social/metrics.ts.
    const comparable = comparableFields(platformPosts);

    platforms.push({
      platform,
      ours,
      competitors,
      fieldMedianEngagement: median(
        competitors.map((c) => c.medianEngagement).filter((v): v is number => v !== null),
      ),
      fieldMedianRate: median(
        competitors.map((c) => c.medianRate).filter((v): v is number => v !== null),
      ),
      comparableOn: [...comparable],
      comparisonBlocked:
        competitors.length === 0
          ? `No competitor data on ${platformLabel(platform)} in this pull — there is nothing to rank against, and our numbers here must not be described as leading or lagging.`
          : null,
    });
  }

  platforms.sort((a, b) => a.platform.localeCompare(b.platform));

  return {
    windowDays,
    platforms,
    tagDeltas: computeTagDeltas(posts),
    totals: {
      ourPosts: posts.filter((p) => p.isOurs).length,
      competitorPosts: posts.filter((p) => !p.isOurs).length,
      accounts: groupByAccount(posts).size,
    },
  };
}

/**
 * Tags where our usage and the field's diverge most.
 *
 * Sorted by the size of the gap in either direction: a tag the field uses
 * fifteen times and we use never is a coverage gap, and one we use constantly
 * that nobody else does is either a signature or a habit nobody is searching.
 * Both are worth an editor's attention, and ranking by raw frequency would
 * surface neither.
 */
export function computeTagDeltas(posts: SocialPost[], limit = 25): TagDelta[] {
  const ours = new Map(tagFrequency(posts.filter((p) => p.isOurs), 500).map((t) => [t.tag, t.count]));
  const theirs = new Map(
    tagFrequency(posts.filter((p) => !p.isOurs), 500).map((t) => [t.tag, t.count]),
  );

  const tags = new Set([...ours.keys(), ...theirs.keys()]);
  return [...tags]
    .map((tag) => ({
      tag,
      oursCount: ours.get(tag) ?? 0,
      theirsCount: theirs.get(tag) ?? 0,
    }))
    .filter((d) => d.oursCount + d.theirsCount >= 2)
    .sort((a, b) => Math.abs(b.oursCount - b.theirsCount) - Math.abs(a.oursCount - a.theirsCount))
    .slice(0, limit);
}

/** The field stats as prompt text. Every number an agent cites comes from here. */
export function renderFieldStats(stats: FieldStats): string {
  const lines: string[] = [
    `FIELD STATISTICS — ${stats.windowDays}-day window`,
    `${stats.totals.ourPosts} posts from us, ${stats.totals.competitorPosts} from competitors, across ${stats.totals.accounts} accounts.`,
    '',
    'These figures are computed, not estimated. Use them; do not recompute them from the post list.',
    '',
  ];

  for (const platform of stats.platforms) {
    lines.push(`── ${platformLabel(platform.platform).toUpperCase()} ──`);
    lines.push(
      `   comparable metrics on this platform: ${platform.comparableOn.length ? platform.comparableOn.join(' + ') : 'none — accounts here report different fields, so totals are NOT comparable'}`,
    );
    if (platform.comparisonBlocked) lines.push(`   ⚠ ${platform.comparisonBlocked}`);

    const rows = [platform.ours, ...platform.competitors].filter((a): a is FieldAccount => a !== null);
    for (const account of rows) {
      lines.push(
        `   ${account.isOurs ? 'OURS      ' : 'competitor'} @${account.handle}` +
          `  followers:${compactNumber(account.followers)}` +
          `  posts:${account.posts} (${account.postsPerWeek}/wk)` +
          `  median engagement:${compactNumber(account.medianEngagement)}` +
          `  median rate:${account.medianRate === null ? '—' : `${account.medianRate}%`}` +
          (account.totalCollects !== null ? `  collects:${compactNumber(account.totalCollects)}` : ''),
      );
      lines.push(`      movement: ${renderMovement(account.movement)}`);
      const mix = account.formatMix
        .map((f) => `${f.mediaType} ${Math.round(f.share * 100)}%${f.medianEngagement !== null ? ` (med ${compactNumber(f.medianEngagement)})` : ''}`)
        .join(', ');
      if (mix) lines.push(`      formats: ${mix}`);
    }

    if (platform.fieldMedianEngagement !== null && platform.ours?.medianEngagement != null) {
      const delta = platform.ours.medianEngagement - platform.fieldMedianEngagement;
      lines.push(
        `   Ours: ${compactNumber(platform.ours.medianEngagement)} vs field median ${compactNumber(platform.fieldMedianEngagement)} (${delta >= 0 ? '+' : ''}${compactNumber(delta)})`,
      );
    }
    lines.push('');
  }

  if (stats.tagDeltas.length) {
    lines.push('TAG DIVERGENCE (ours vs the field, biggest gaps first):');
    for (const d of stats.tagDeltas.slice(0, 15)) {
      lines.push(`   #${d.tag} — ours ${d.oursCount}, field ${d.theirsCount}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderMovement(m: Movement): string {
  if (!m.sufficient) {
    return `not enough posts to read (${m.recentCount} recent vs ${m.previousCount} prior — 2 a side is the minimum; do not describe this as a rise or a fall)`;
  }
  if (m.changePct === null) {
    return `recent median ${compactNumber(m.recent)} vs prior ${compactNumber(m.previous)} (no percentage — the prior half was zero)`;
  }
  return `recent median ${compactNumber(m.recent)} vs prior ${compactNumber(m.previous)} (${m.changePct >= 0 ? '+' : ''}${m.changePct}%)`;
}

/** The single most useful line for a dashboard header. */
export function headlineComparison(stats: FieldStats): string {
  const scored = stats.platforms
    .filter((p) => p.ours?.medianRate != null && p.fieldMedianRate != null)
    .map((p) => ({
      platform: p.platform,
      delta: (p.ours!.medianRate as number) - (p.fieldMedianRate as number),
    }))
    .sort((a, b) => b.delta - a.delta);

  if (scored.length === 0) return 'Not enough overlapping data to rank us against the field yet.';

  const best = scored[0];
  const worst = scored[scored.length - 1];
  if (scored.length === 1) {
    return `${platformLabel(best.platform)}: we run ${best.delta >= 0 ? '+' : ''}${best.delta.toFixed(2)} points of engagement rate against the field median.`;
  }
  return (
    `Strongest on ${platformLabel(best.platform)} (${best.delta >= 0 ? '+' : ''}${best.delta.toFixed(2)} pts vs field), ` +
    `weakest on ${platformLabel(worst.platform)} (${worst.delta >= 0 ? '+' : ''}${worst.delta.toFixed(2)} pts).`
  );
}
