'use client';

/**
 * Composer — drafts for a story we are actually publishing.
 *
 * The story is picked from Sanity rather than typed, because the composer's
 * central constraint is that it may only claim what the story says, and that
 * constraint is worth nothing if the "story" is a paragraph someone pasted in.
 *
 * Each draft shows whether its format choice was grounded in our own numbers
 * or inferred from platform convention. That badge is the difference between
 * advice and a guess, and an editor deserves to know which they are reading.
 */
import { useEffect, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { StoryBrief, Draft } from '@/lib/social/agents/composer';
import type { AgentProvider } from '@/lib/social/types';
import { fetchStories, runCompose, type ComposeResult } from './api';
import {
  Banner,
  Empty,
  ParseErrorNotice,
  PlatformPill,
  ProviderPicker,
  RunButton,
  SectionLabel,
  Spinner,
} from './shared';

export function ComposerTab({ account }: { account: Account | null }) {
  const [stories, setStories] = useState<StoryBrief[] | null>(null);
  const [slug, setSlug] = useState('');
  const [provider, setProvider] = useState<AgentProvider>('claude');
  const [busy, setBusy] = useState(false);
  const [loadingStories, setLoadingStories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComposeResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchStories(account);
        if (!alive) return;
        setStories(rows);
        if (rows.length > 0) setSlug(rows[0].slug);
      } catch (err: any) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoadingStories(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one load per mount; a wallet switch does not change the story list
  }, []);

  async function run() {
    if (!slug) {
      setError('Pick a story first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await runCompose(account, { slug, provider }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = stories?.find((s) => s.slug === slug) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl">Composer</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          Drafts a post per platform for a story from the CMS. It may only claim what the story
          says, and it is shown which of our own posts actually performed — so format advice comes
          from our numbers rather than from what a model remembers about Instagram.
        </p>
      </div>

      {loadingStories ? (
        <Spinner label="Loading stories from the CMS…" />
      ) : !stories || stories.length === 0 ? (
        <Empty>No stories came back from the CMS. Check the Sanity configuration.</Empty>
      ) : (
        <div className="flex items-end gap-4 flex-wrap">
          <label className="flex-1 min-w-[280px]">
            <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
              Story
            </span>
            <select
              value={slug}
              disabled={busy}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
            >
              {stories.map((story) => (
                <option key={story.slug} value={story.slug}>
                  {story.title}
                </option>
              ))}
            </select>
          </label>
          <ProviderPicker value={provider} onChange={setProvider} disabled={busy} />
          <RunButton onClick={run} busy={busy}>
            Draft the posts
          </RunButton>
        </div>
      )}

      {selected && !busy && (
        <div className="border border-gray-200 rounded-md p-4">
          <SectionLabel>What the composer is working from</SectionLabel>
          <p className="font-adonis text-xl text-gray-900">{selected.title}</p>
          {selected.excerpt && (
            <p className="font-georgia-pro text-[15px] text-gray-600 mt-1">{selected.excerpt}</p>
          )}
          <p className="font-mono text-[11px] text-gray-400 mt-2">
            {selected.author ? `${selected.author} · ` : ''}
            {selected.publishedAt ? `${selected.publishedAt.slice(0, 10)} · ` : ''}
            {selected.opening
              ? `${selected.opening.length} characters of the piece`
              : 'headline and standfirst only — drafts will say so'}
          </p>
        </div>
      )}

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && <Spinner label="Reading the story and our own performance, then drafting…" />}

      {result && !busy && (
        <>
          <ParseErrorNotice error={result.result.parseError} />

          {result.result.angle && (
            <div className="border-l-2 border-black pl-4 py-1">
              <SectionLabel>Angle</SectionLabel>
              <p className="font-georgia-pro text-[16px] text-gray-900">{result.result.angle}</p>
            </div>
          )}

          {result.evidencePosts === 0 && (
            <Banner tone="warn">
              No collected posts of our own were available, so every format choice below rests on
              platform convention rather than our data. Run a Pulse pull first and re-draft to get
              grounded advice.
            </Banner>
          )}

          <div className="space-y-4">
            {result.result.drafts.map((draft, i) => (
              <DraftCard key={i} draft={draft} />
            ))}
          </div>

          {result.result.avoided.length > 0 && (
            <div className="border border-gray-200 rounded-md p-4">
              <SectionLabel>Deliberately not claimed</SectionLabel>
              <ul className="space-y-1.5">
                {result.result.avoided.map((item, i) => (
                  <li key={i} className="font-georgia-pro text-[14px] text-gray-600">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] font-mono text-gray-400">
            drafted by {result.result.model} · grounded in {result.evidencePosts} of our own posts
          </p>
        </>
      )}
    </div>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const [copied, setCopied] = useState(false);
  const full = draft.tags.length
    ? `${draft.body}\n\n${draft.tags.map((t) => `#${t}`).join(' ')}`
    : draft.body;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access can be denied; the text is selectable either way.
      setCopied(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <PlatformPill platform={draft.platform} />
        <span
          className={`text-[10px] uppercase tracking-[0.12em] font-mono ${
            draft.confidence === 'grounded' ? 'text-emerald-700' : 'text-amber-700'
          }`}
          title={
            draft.confidence === 'grounded'
              ? 'The format choice is based on our own posts and their engagement rates.'
              : 'No performance data was available for this platform — the format rests on convention.'
          }
        >
          {draft.confidence}
        </span>
        <button
          onClick={copy}
          className="ml-auto text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900 transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="p-4">
        <p className="font-georgia-pro text-[15px] text-gray-900 whitespace-pre-wrap leading-relaxed">
          {draft.body}
        </p>
        {draft.tags.length > 0 && (
          <p className="font-mono text-[12px] text-gray-500 mt-3">
            {draft.tags.map((t) => `#${t}`).join(' ')}
          </p>
        )}
      </div>

      {(draft.asset || draft.rationale) && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-1">
          {draft.asset && (
            <p className="font-georgia-pro text-[13px] text-gray-600">
              <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400 mr-2">
                asset
              </span>
              {draft.asset}
            </p>
          )}
          {draft.rationale && (
            <p className="font-georgia-pro text-[13px] text-gray-500">
              <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400 mr-2">why</span>
              {draft.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
