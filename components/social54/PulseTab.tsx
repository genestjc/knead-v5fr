'use client';

/**
 * Pulse — everything, everywhere, at a glance.
 *
 * A grid rather than stacked tables, because the question this screen answers
 * is "what are we pulling, and is any of it moving" — and that is a scanning
 * question. Five platform tables stacked vertically make you scroll to compare
 * two numbers that should have been side by side.
 *
 * Three things the layout is arranged to keep honest:
 *
 *  • OUR cards come first and are marked, so the screen is about us and the
 *    field is context, rather than a leaderboard we read ourselves off.
 *  • Every platform gets a card whether or not it returned anything. A
 *    platform simply missing from a dashboard reads as a platform with nothing
 *    happening on it.
 *  • A platform that is reachable and returned NOTHING says so loudly and
 *    guesses why — a wrong handle is by far the most common cause and is
 *    otherwise indistinguishable from a quiet week.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { PlatformStatus } from '@/lib/social/config';
import type { FieldAccount } from '@/lib/social/field';
import { compactNumber } from '@/lib/social/metrics';
import { platformLabel, type SocialPost } from '@/lib/social/types';
import { runPulse, type PulseResult } from './api';
import {
  Banner,
  CaveatPanel,
  Empty,
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

  const reachable = platforms.filter((p) => p.configured || p.publicReadable).length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h2 className="font-adonis text-2xl">Pulse</h2>
          <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
            One pull across every platform we can reach, ours and the roster&rsquo;s. Collected
            posts are archived, which is what lets Trends look further back than any platform API
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

      <ReachGrid platforms={platforms} archive={archive} />

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && (
        <Spinner
          label={`Collecting across ${reachable} reachable platform${reachable === 1 ? '' : 's'}…`}
        />
      )}

      {!busy && !result && <Empty>Nothing pulled yet. Choose a window and hit Pull now.</Empty>}

      {result && !busy && (
        <>
          {result.archiveError && <Banner tone="warn">{result.archiveError}</Banner>}

          <HeadlineRow result={result} />
          <CaveatPanel caveats={result.caveats} />

          <OurGrid result={result} />
          <PostList result={result} />
          <FieldGrid result={result} />
        </>
      )}
    </div>
  );
}

/* ─── what the environment can reach, before anything is pulled ─────────── */

function ReachGrid({
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
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <SectionLabel>What this console can reach</SectionLabel>
        <span className="text-[11px] font-mono text-gray-500">
          archive: {archive.posts} posts{archiveDays !== null ? ` · ${archiveDays}d deep` : ' · empty'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) => (
          <div
            key={p.platform}
            className={`border rounded-md px-3 py-2.5 ${
              p.configured || p.publicReadable ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <PlatformPill platform={p.platform} />
              {p.configured ? (
                <SourcePill source="api" />
              ) : p.publicReadable ? (
                <SourcePill source="public" />
              ) : (
                <SourcePill source="none" />
              )}
            </div>

            <div className="font-mono text-xs text-gray-600 mt-1.5">
              {p.ownHandle ? `@${p.ownHandle}` : <span className="text-red-600">no handle set</span>}
            </div>

            {/* Free-and-ready is called out as a positive: it is the reason
                this console works on day one. */}
            {p.freeAndReady && !p.configured && (
              <div
                className="text-[11px] font-mono text-emerald-700 mt-1"
                title="Collects with no credentials and no spend."
              >
                free · no setup
              </div>
            )}

            {!p.configured && p.missingEnv.length > 0 && (
              <div className="text-[11px] font-mono text-gray-400 mt-1 break-words">
                {p.publicReadable ? 'optional: ' : 'needs: '}
                {p.missingEnv.join(', ')}
                {p.costsMoney && (
                  <span
                    className="text-amber-700"
                    title="Reading this platform at a useful volume generally requires a paid API tier."
                  >
                    {' '}
                    · paid tier
                  </span>
                )}
              </div>
            )}

            {p.configured && p.missingOptionalEnv.length > 0 && (
              <div
                className="text-[11px] font-mono text-gray-400 mt-1 break-words"
                title="Optional — the platform is already collecting without this."
              >
                add for more: {p.missingOptionalEnv.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── results ───────────────────────────────────────────────────────────── */

function HeadlineRow({ result }: { result: PulseResult }) {
  const ourPosts = result.snapshot.platforms.reduce(
    (sum, p) => sum + p.posts.filter((post) => post.isOurs).length,
    0,
  );
  const theirPosts = result.snapshot.platforms.reduce(
    (sum, p) => sum + p.posts.filter((post) => !post.isOurs).length,
    0,
  );

  return (
    <div className="border-l-2 border-black pl-4 py-1">
      <SectionLabel>Where we stand</SectionLabel>
      <p className="font-georgia-pro text-lg text-gray-900">{result.headline}</p>
      <p className="text-[11px] text-gray-400 font-mono mt-1">
        {ourPosts} of ours · {theirPosts} theirs · {result.archived} archived ·{' '}
        {new Date(result.snapshot.fetchedAt).toLocaleString()}
      </p>
    </div>
  );
}

/** Our accounts, one card each, biggest first. This is the part about us. */
function OurGrid({ result }: { result: PulseResult }) {
  const ours = result.stats.platforms
    .map((p) => p.ours)
    .filter((a): a is FieldAccount => a !== null);

  const emptyButReachable = result.snapshot.platforms.filter(
    (p) => p.ok && p.posts.length === 0 && p.source !== 'none',
  );

  return (
    <div>
      <SectionLabel>Us</SectionLabel>
      {ours.length === 0 ? (
        <Empty>No platform returned any of our posts in this window.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ours.map((account) => (
            <AccountCard key={`${account.platform}:${account.handle}`} account={account} ours />
          ))}
        </div>
      )}

      {/* Reachable, and returned nothing. Almost always a wrong handle, and
          otherwise indistinguishable from a quiet fortnight. */}
      {emptyButReachable.map((platform) => (
        <div
          key={platform.platform}
          className="mt-3 border border-amber-200 bg-amber-50 rounded-md px-4 py-3"
        >
          <p className="font-georgia-pro text-[14px] text-amber-900">
            <strong className="font-medium">
              {platformLabel(platform.platform)} was reachable but returned no posts.
            </strong>{' '}
            That is usually a handle that doesn&rsquo;t exist rather than a quiet fortnight — check
            the handle above against the real account, or widen the window.
            {platform.error ? ` The connector also said: ${platform.error}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The field, grouped by platform so unlike things don't sit side by side. */
function FieldGrid({ result }: { result: PulseResult }) {
  const withCompetitors = result.stats.platforms.filter((p) => p.competitors.length > 0);

  if (withCompetitors.length === 0) {
    return (
      <div>
        <SectionLabel>The field</SectionLabel>
        <Empty>
          No competitor data came back on any platform. Their handles may be unset, or the platforms
          that carry them may be unconfigured — either way this says nothing about their activity.
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionLabel>The field</SectionLabel>
      {withCompetitors.map((platform) => (
        <div key={platform.platform}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <PlatformPill platform={platform.platform} />
            <span className="font-mono text-[10px] text-gray-400">
              compared on {platform.comparableOn.join(' + ') || 'nothing comparable'}
            </span>
          </div>

          {!platform.comparability.rateIsMeaningful && (
            <p className="font-georgia-pro text-[13px] text-amber-800 mb-2">
              <strong className="font-medium">Rate isn&rsquo;t comparable here.</strong>{' '}
              {platform.comparability.explanation}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {platform.competitors.map((account) => (
              <AccountCard key={`${account.platform}:${account.handle}`} account={account} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountCard({ account, ours }: { account: FieldAccount; ours?: boolean }) {
  const movement = account.movement;

  return (
    <div
      className={`border rounded-md p-4 ${ours ? 'border-gray-900' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <PlatformPill platform={account.platform} />
        {ours && (
          <span
            className="text-[10px] uppercase tracking-[0.12em] font-medium"
            style={{ color: '#FF6B6B' }}
          >
            ours
          </span>
        )}
      </div>

      <div className="font-mono text-sm text-gray-900 mt-1.5 truncate" title={account.handle}>
        @{account.handle}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
        <Stat label="Followers" value={compactNumber(account.followers)} />
        <Stat label="Posts" value={`${account.posts}`} sub={`${account.postsPerWeek}/wk`} />
        <Stat
          label="Median eng."
          value={compactNumber(account.medianEngagement)}
          title={
            account.fields.length
              ? `Summed over ${account.fields.join(' + ')}`
              : 'No metric is reported by every account on this platform, so a total would not be comparable'
          }
        />
        <Stat
          label="Median rate"
          value={account.medianRate === null ? '—' : `${account.medianRate}%`}
          title="Engagement as a share of followers"
        />
      </div>

      {account.totalCollects !== null && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <Stat
            label="Collects"
            value={compactNumber(account.totalCollects)}
            title="Paid actions — deliberately never folded into the engagement total"
          />
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Movement</div>
        {movement.changePct !== null ? (
          <div
            className={`font-mono text-sm ${
              movement.changePct >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {movement.changePct >= 0 ? '+' : ''}
            {movement.changePct}%
            <span className="text-gray-400 text-xs ml-1.5">
              {compactNumber(movement.previous)} → {compactNumber(movement.recent)}
            </span>
          </div>
        ) : movement.recent !== null && movement.previous !== null ? (
          // Absolute numbers rather than a dash: at small volumes "4 → 8" is
          // honest and perfectly readable, where "+100%" is neither.
          <div className="font-mono text-sm text-gray-400" title={movement.withheldReason ?? undefined}>
            {compactNumber(movement.previous)} → {compactNumber(movement.recent)}
            <span className="text-[10px] ml-1.5">no %</span>
          </div>
        ) : (
          <div className="font-mono text-sm text-gray-300" title={movement.withheldReason ?? undefined}>
            too thin
          </div>
        )}
      </div>

      {account.formatMix.length > 0 && (
        <div className="mt-2 text-[11px] font-mono text-gray-400 truncate" title={
          account.formatMix.map((f) => `${f.mediaType} ${Math.round(f.share * 100)}%`).join(', ')
        }>
          {account.formatMix
            .slice(0, 3)
            .map((f) => `${f.mediaType} ${Math.round(f.share * 100)}%`)
            .join(' · ')}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  title?: string;
}) {
  return (
    <div title={title}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400">{label}</div>
      <div className={`font-mono text-sm ${value === '—' ? 'text-gray-300' : 'text-gray-900'}`}>
        {value}
        {sub && <span className="text-gray-400 text-xs ml-1">{sub}</span>}
      </div>
    </div>
  );
}

/**
 * The posts themselves.
 *
 * Summary cards tell you the shape of a pull; they don't tell you whether the
 * thing you're looking at is your account. This lists the actual rows, ours
 * first, so "what are we pulling" has a literal answer on the same screen —
 * and so a handle pointing at the wrong account is obvious immediately rather
 * than after a week of plausible-looking medians.
 */
function PostList({ result }: { result: PulseResult }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(true);

  const all = result.snapshot.platforms.flatMap((p) => p.posts);
  const shown = (mine ? all.filter((p) => p.isOurs) : all)
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  if (all.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-md">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] uppercase tracking-[0.16em] text-gray-500 hover:text-gray-900 transition-colors"
        >
          {open ? 'Hide the posts' : `Show the ${all.length} posts this pull returned`}
        </button>
        {open && (
          <div className="inline-flex rounded-md overflow-hidden border border-gray-300 divide-x divide-gray-300">
            {[
              { id: true, label: 'Ours' },
              { id: false, label: 'Everything' },
            ].map((option) => (
              <button
                key={String(option.id)}
                onClick={() => setMine(option.id)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  mine === option.id ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 font-georgia-pro italic text-center">
              Nothing of ours came back in this window.
            </p>
          ) : (
            shown.map((post) => <PostRow key={`${post.platform}:${post.id}`} post={post} />)
          )}
        </div>
      )}
    </div>
  );
}

function PostRow({ post }: { post: SocialPost }) {
  const total = sumFree(post.metrics);
  return (
    <div className={`px-4 py-3 ${post.isOurs ? 'bg-gray-50' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <PlatformPill platform={post.platform} />
        <span className="font-mono text-[11px] text-gray-600">@{post.authorHandle}</span>
        {post.isOurs && (
          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#FF6B6B' }}>
            ours
          </span>
        )}
        <span className="font-mono text-[11px] text-gray-400">{post.publishedAt.slice(0, 10)}</span>
        <span className="font-mono text-[11px] text-gray-600">
          {total === null ? 'no metrics' : `${compactNumber(total)} eng.`}
        </span>
        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-400 hover:text-gray-900 underline ml-auto"
          >
            open
          </a>
        )}
      </div>
      <p className="font-georgia-pro text-[14px] text-gray-800 mt-1 leading-snug">
        {post.text.slice(0, 240) || <span className="italic text-gray-400">(no text)</span>}
        {post.text.length > 240 ? '…' : ''}
      </p>
    </div>
  );
}

function sumFree(metrics: SocialPost['metrics']): number | null {
  const fields = ['likes', 'comments', 'reposts', 'quotes', 'saves'] as const;
  const present = fields.filter((f) => typeof metrics[f] === 'number');
  if (present.length === 0) return null;
  return present.reduce((sum, f) => sum + (metrics[f] as number), 0);
}
