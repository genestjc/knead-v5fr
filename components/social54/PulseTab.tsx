'use client';

/**
 * Pulse — everything, everywhere, right now.
 *
 * The opening screen, and the one that has to be honest without being read
 * carefully. Two decisions carry that:
 *
 *  • Every platform gets a panel whether or not it returned anything, with its
 *    source and its reason. A platform that is simply missing from a dashboard
 *    reads as a platform with nothing happening on it.
 *  • The comparison column is engagement RATE, not counts. Sorting our 4,000
 *    followers against a competitor's 400,000 on raw likes produces a ranking
 *    of follower counts.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { PlatformStatus } from '@/lib/social/config';
import { compactNumber } from '@/lib/social/metrics';
import { platformLabel, type PlatformResult, type SocialPlatform } from '@/lib/social/types';
import type { FieldAccount } from '@/lib/social/field';
import { runPulse, type PulseResult } from './api';
import {
  Banner,
  CaveatPanel,
  Empty,
  MetricCell,
  PlatformPill,
  RunButton,
  SectionLabel,
  SourcePill,
  Spinner,
  WindowPicker,
} from './shared';

export function PulseTab({
  account,
  platforms,
  archive,
}: {
  account: Account | null;
  platforms: PlatformStatus[];
  archive: { earliest: string | null; posts: number };
}) {
  const [windowDays, setWindowDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PulseResult | null>(null);

  async function pull() {
    setBusy(true);
    setError(null);
    try {
      setResult(await runPulse(account, { windowDays }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const configuredCount = platforms.filter((p) => p.configured || p.publicReadable).length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h2 className="font-adonis text-2xl">Pulse</h2>
          <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
            One pull across every platform we can reach, ours and the roster&rsquo;s. Collected posts
            are archived, which is what lets the Trends tab look further back than any platform API
            allows.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <WindowPicker value={windowDays} onChange={setWindowDays} disabled={busy} />
          <RunButton onClick={pull} busy={busy}>
            Pull now
          </RunButton>
        </div>
      </div>

      <ReachPanel platforms={platforms} archive={archive} />

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && (
        <Spinner
          label={`Collecting across ${configuredCount} reachable platform${configuredCount === 1 ? '' : 's'}…`}
        />
      )}

      {!busy && !result && (
        <Empty>Nothing pulled yet. Choose a window and hit Pull now.</Empty>
      )}

      {result && !busy && (
        <>
          {result.archiveError && <Banner tone="warn">{result.archiveError}</Banner>}

          <div className="border-l-2 pl-4 py-1" style={{ borderColor: '#111' }}>
            <SectionLabel>Where we stand</SectionLabel>
            <p className="font-georgia-pro text-lg text-gray-900">{result.headline}</p>
            <p className="text-[11px] text-gray-400 font-mono mt-1">
              {result.archived} post{result.archived === 1 ? '' : 's'} archived ·{' '}
              {new Date(result.snapshot.fetchedAt).toLocaleString()}
            </p>
          </div>

          <CaveatPanel caveats={result.caveats} />

          <div className="space-y-6">
            {result.snapshot.platforms.map((platform) => (
              <PlatformPanel
                key={platform.platform}
                platform={platform}
                accounts={accountsFor(result, platform.platform)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function accountsFor(result: PulseResult, platform: SocialPlatform): FieldAccount[] {
  const field = result.stats.platforms.find((p) => p.platform === platform);
  if (!field) return [];
  return [field.ours, ...field.competitors].filter((a): a is FieldAccount => a !== null);
}

/** What this environment can actually see, before anything is pulled. */
function ReachPanel({
  platforms,
  archive,
}: {
  platforms: PlatformStatus[];
  archive: { earliest: string | null; posts: number };
}) {
  const archiveDays = archive.earliest
    ? Math.round((Date.now() - Date.parse(archive.earliest)) / 86_400_000)
    : null;

  return (
    <div className="border border-gray-200 rounded-md">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <SectionLabel>What this console can reach</SectionLabel>
        <span className="text-[11px] font-mono text-gray-500">
          archive: {archive.posts} posts
          {archiveDays !== null ? ` · ${archiveDays}d deep` : ' · empty'}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {platforms.map((p) => (
          <div key={p.platform} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
            <PlatformPill platform={p.platform} />
            <span className="font-mono text-xs text-gray-600">
              {p.ownHandle ? `@${p.ownHandle}` : 'no handle set'}
            </span>
            {p.configured ? (
              <SourcePill source="api" />
            ) : p.publicReadable ? (
              <SourcePill source="public" />
            ) : (
              <SourcePill source="none" />
            )}

            {/* Free-and-ready is called out rather than left to be inferred
                from a missing warning — it's the reason this console works on
                day one, and it should be visible as a positive. */}
            {p.freeAndReady && !p.configured && (
              <span
                className="text-[11px] font-mono text-emerald-700"
                title="Collects with no credentials and no spend."
              >
                free · no setup
              </span>
            )}

            {!p.configured && p.missingEnv.length > 0 && (
              <span className="text-[11px] font-mono text-gray-400">
                {p.publicReadable ? 'optional upgrade: ' : 'needs: '}
                {p.missingEnv.join(', ')}
                {p.costsMoney && (
                  <span className="text-amber-700" title="Reading this platform at a useful volume generally requires a paid API tier.">
                    {' '}
                    · paid tier
                  </span>
                )}
              </span>
            )}

            {/* Shown once the platform is running: what it still can't see. */}
            {p.configured && p.missingOptionalEnv.length > 0 && (
              <span
                className="text-[11px] font-mono text-gray-400"
                title="Optional — the platform is already collecting without this."
              >
                add for more: {p.missingOptionalEnv.join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformPanel({
  platform,
  accounts,
}: {
  platform: PlatformResult;
  accounts: FieldAccount[];
}) {
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <h3 className="font-adonis text-lg">{platformLabel(platform.platform)}</h3>
        <SourcePill source={platform.source} />
        <span className="text-[11px] font-mono text-gray-500">
          {platform.posts.length} post{platform.posts.length === 1 ? '' : 's'}
          {platform.comments.length > 0 ? ` · ${platform.comments.length} replies` : ''}
          {platform.fetchedMs ? ` · ${platform.fetchedMs}ms` : ''}
        </span>
      </div>

      {platform.error && (
        <p className="px-4 py-2.5 text-[13px] font-georgia-pro text-red-800 bg-red-50 border-b border-red-100">
          {platform.error}
        </p>
      )}
      {platform.note && (
        <p className="px-4 py-2.5 text-[13px] font-georgia-pro text-gray-600 border-b border-gray-100">
          {platform.note}
        </p>
      )}

      {accounts.length === 0 ? (
        <p className="px-4 py-5 text-sm text-gray-400 font-georgia-pro italic">
          No accounts returned data on this platform in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
                <th className="px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-right font-medium">Followers</th>
                <th className="px-3 py-2 text-right font-medium">Posts</th>
                <th className="px-3 py-2 text-right font-medium">Per week</th>
                <th className="px-3 py-2 text-right font-medium">Median eng.</th>
                <th className="px-3 py-2 text-right font-medium" title="Engagement as a share of followers — the comparison that survives a follower-count mismatch">
                  Median rate
                </th>
                <th className="px-3 py-2 text-left font-medium">Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.map((account) => (
                <tr key={`${account.platform}:${account.handle}`} className={account.isOurs ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-gray-900">@{account.handle}</span>
                    {account.isOurs && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] font-medium" style={{ color: '#FF6B6B' }}>
                        ours
                      </span>
                    )}
                  </td>
                  <MetricCell value={account.followers} unavailableReason="Follower count not returned for this account" />
                  <MetricCell value={account.posts} />
                  <MetricCell value={account.postsPerWeek} />
                  <MetricCell
                    value={account.medianEngagement}
                    unavailableReason={`No metric here is reported by every account on this platform, so a total would not be comparable`}
                    emphasis={account.isOurs}
                  />
                  <MetricCell
                    value={account.medianRate}
                    suffix="%"
                    unavailableReason="Needs both engagement and a follower count"
                    emphasis={account.isOurs}
                  />
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">
                    {account.movement.changePct !== null ? (
                      <span className={account.movement.changePct >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                        {account.movement.changePct >= 0 ? '+' : ''}
                        {account.movement.changePct}%
                      </span>
                    ) : account.movement.recent !== null && account.movement.previous !== null ? (
                      // The absolute numbers rather than a dash: at small
                      // volumes "4 → 8" is both honest and perfectly readable,
                      // where "+100%" is neither.
                      <span className="text-gray-400" title={account.movement.withheldReason ?? undefined}>
                        {account.movement.previous} → {account.movement.recent}
                      </span>
                    ) : (
                      <span className="text-gray-300" title={account.movement.withheldReason ?? undefined}>
                        too thin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {platform.posts.length > 0 && <TopPosts platform={platform} />}
    </div>
  );
}

function TopPosts({ platform }: { platform: PlatformResult }) {
  const [open, setOpen] = useState(false);
  const top = [...platform.posts]
    .sort((a, b) => {
      const ar = a.authorFollowers ? (sumFree(a.metrics) ?? 0) / a.authorFollowers : -1;
      const br = b.authorFollowers ? (sumFree(b.metrics) ?? 0) / b.authorFollowers : -1;
      return br - ar;
    })
    .slice(0, 6);

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 text-left text-[11px] uppercase tracking-[0.14em] text-gray-400 hover:text-gray-900 transition-colors"
      >
        {open ? 'Hide posts' : `Top posts by rate (${top.length})`}
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-3">
          {top.map((post) => (
            <li key={post.id} className="border-l-2 border-gray-200 pl-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] text-gray-500">@{post.authorHandle}</span>
                {post.isOurs && (
                  <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#FF6B6B' }}>
                    ours
                  </span>
                )}
                <span className="font-mono text-[11px] text-gray-400">
                  {post.publishedAt.slice(0, 10)}
                </span>
                <span className="font-mono text-[11px] text-gray-600">
                  {compactNumber(sumFree(post.metrics))} eng.
                </span>
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-400 hover:text-gray-900 underline"
                  >
                    open
                  </a>
                )}
              </div>
              <p className="font-georgia-pro text-[14px] text-gray-800 mt-1 leading-snug">
                {post.text.slice(0, 220) || <span className="italic text-gray-400">(no text)</span>}
                {post.text.length > 220 ? '…' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Local mirror of the free-interaction sum, for ordering only. */
function sumFree(metrics: PlatformResult['posts'][number]['metrics']): number | null {
  const fields = ['likes', 'comments', 'reposts', 'quotes', 'saves'] as const;
  const present = fields.filter((f) => typeof metrics[f] === 'number');
  if (present.length === 0) return null;
  return present.reduce((sum, f) => sum + (metrics[f] as number), 0);
}
