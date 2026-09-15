'use client';

/**
 * The competitor roster — who every comparison in this console is against.
 *
 * Worth keeping small and deliberate. A publication that posts nowhere we post
 * cannot be beaten or lost to, so it contributes nothing but API calls; the
 * note field exists so a roster entry has to justify itself in writing.
 *
 * Deactivating is offered before deleting. An inactive competitor stops being
 * collected but keeps their archived posts, so a comparison run against last
 * month still resolves.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import {
  SOCIAL_PLATFORMS,
  platformLabel,
  type Competitor,
  type CompetitorHandle,
  type SocialPlatform,
} from '@/lib/social/types';
import { addCompetitor, patchCompetitor, removeCompetitor } from './api';
import { Banner, Empty, PlatformPill, SectionLabel } from './shared';

export function CompetitorsTab({
  account,
  competitors,
  seedError,
  onChanged,
}: {
  account: Account | null;
  competitors: Competitor[];
  seedError: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(competitor: Competitor) {
    setBusyId(competitor.id);
    setError(null);
    try {
      await patchCompetitor(account, competitor.id, { isActive: !competitor.isActive });
      await onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(competitor: Competitor) {
    if (
      !window.confirm(
        `Remove ${competitor.name} from the roster? Their archived posts are kept — the archive is keyed by handle, so past comparisons still resolve.`,
      )
    ) {
      return;
    }
    setBusyId(competitor.id);
    setError(null);
    try {
      await removeCompetitor(account, competitor.id);
      await onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl">Competitors</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          Every comparison in this console is against this roster. A <strong>site URL</strong> is
          worth as much as a handle here, often more: coverage and cadence read straight from a
          publication&rsquo;s own feed, need no credentials, and stay a fair comparison however
          much bigger their audience is — which engagement does not.
        </p>
      </div>

      {seedError && <Banner tone="warn">{seedError}</Banner>}
      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}
      {notice && (
        <Banner tone="info" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}

      <AddCompetitorForm
        account={account}
        onAdded={onChanged}
        onError={setError}
        onFeedNote={setNotice}
      />

      {competitors.length === 0 ? (
        <Empty>The roster is empty. Add a publication above.</Empty>
      ) : (
        <div className="space-y-3">
          {competitors.map((competitor) => (
            <div
              key={competitor.id}
              className={`border rounded-md p-4 ${
                competitor.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={`font-adonis text-lg ${
                        competitor.isActive ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {competitor.name}
                    </h3>
                    {!competitor.isActive && (
                      <span className="text-[10px] uppercase tracking-[0.12em] font-mono text-gray-400">
                        not collected
                      </span>
                    )}
                  </div>
                  {competitor.note && (
                    <p className="font-georgia-pro text-[14px] text-gray-600 mt-0.5">
                      {competitor.note}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {competitor.handles.map((handle) => (
                      <span
                        key={`${handle.platform}:${handle.handle}`}
                        className="inline-flex items-center gap-1.5"
                      >
                        <PlatformPill platform={handle.platform} />
                        <span className="font-mono text-[11px] text-gray-600">@{handle.handle}</span>
                      </span>
                    ))}
                    {competitor.feedUrl ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono bg-emerald-50 text-emerald-800 border-emerald-200"
                        title={competitor.feedUrl}
                      >
                        feed
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono bg-gray-50 text-gray-400 border-gray-200"
                        title="No feed, so this publication's coverage is not tracked — only whatever its social handles return."
                      >
                        no feed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggle(competitor)}
                    disabled={busyId === competitor.id}
                    className="text-[11px] uppercase tracking-[0.12em] text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors"
                  >
                    {competitor.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button
                    onClick={() => remove(competitor)}
                    disabled={busyId === competitor.id}
                    className="text-[11px] uppercase tracking-[0.12em] text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCompetitorForm({
  account,
  onAdded,
  onError,
  onFeedNote,
}: {
  account: Account | null;
  onAdded: () => void | Promise<void>;
  onError: (message: string) => void;
  onFeedNote: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [handles, setHandles] = useState<Record<SocialPlatform, string>>({
    instagram: '',
    x: '',
    farcaster: '',
    zora: '',
    linkedin: '',
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    const entries: CompetitorHandle[] = SOCIAL_PLATFORMS.map((platform) => ({
      platform,
      handle: handles[platform].trim().replace(/^@/, '').toLowerCase(),
    })).filter((h) => h.handle);

    if (!name.trim()) return onError('A name is required.');
    if (entries.length === 0 && !siteUrl.trim()) {
      return onError(
        'Add at least one platform handle or a site URL — a competitor with neither is never collected.',
      );
    }

    setBusy(true);
    try {
      const { feedNote } = await addCompetitor(account, {
        name: name.trim(),
        note: note.trim(),
        handles: entries,
        feedUrl: siteUrl.trim(),
      });
      setName('');
      setNote('');
      setSiteUrl('');
      setHandles({ instagram: '', x: '', farcaster: '', zora: '', linkedin: '' });
      setOpen(false);
      await onAdded();
      // Discovery result is reported even on success: "added, but no feed was
      // found" and "added with a working feed" are different outcomes and the
      // roster row looks identical either way.
      if (feedNote) onFeedNote(feedNote);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors"
      >
        Add a publication
      </button>
    );
  }

  return (
    <div className="border border-gray-900 rounded-md p-4 space-y-4">
      <SectionLabel>New competitor</SectionLabel>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
          />
        </label>
        <label>
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
            Why they are on the roster
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            placeholder="What they compete with us for"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
          Site URL — their homepage
        </span>
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          disabled={busy}
          placeholder="https://hyperallergic.com — the feed is found from this"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono disabled:opacity-50"
        />
        <span className="font-georgia-pro text-[13px] text-gray-400 block mt-1">
          Paste the homepage, not the feed — the feed is discovered from it. This is what powers
          coverage tracking, and it needs no credentials.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOCIAL_PLATFORMS.map((platform) => (
          <label key={platform}>
            <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
              {platformLabel(platform)}
            </span>
            <input
              value={handles[platform]}
              onChange={(e) => setHandles((prev) => ({ ...prev, [platform]: e.target.value }))}
              disabled={busy}
              placeholder="handle, without the @"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono disabled:opacity-50"
            />
          </label>
        ))}
      </div>

      <p className="font-georgia-pro text-[13px] text-gray-400">
        LinkedIn handles are stored but not collected — LinkedIn scopes post reads to pages our
        token administers, so competitor data there has to come from a pasted comparison.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="px-5 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="text-[11px] uppercase tracking-[0.12em] text-gray-500 hover:text-gray-900 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
