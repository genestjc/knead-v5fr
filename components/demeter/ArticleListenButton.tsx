'use client';

import { useEffect, useRef, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useMembership } from '@/components/membership-provider';
import { ARTICLE_LIMITS } from '@/lib/constants';

type Status = 'idle' | 'loading' | 'playing' | 'paused';

/**
 * "Listen to a summary of this article" — generates a spoken summary of the
 * article (via /api/demeter/article-summary-audio) on first play, then toggles
 * playback. The generated audio is cached for the page visit so replays are free.
 *
 * Access mirrors article-read access exactly:
 *   - Free (non-premium) articles: anyone, including signed-out visitors.
 *   - Premium articles: signed-in users who are premium members, OR freemium
 *     users still within their read limit (same rule as UnlockContent). The
 *     limit is checked read-only (checkOnly) so the button never consumes a read.
 */
export function ArticleListenButton({
  slug,
  contentId,
  isPremium,
}: {
  slug: string;
  contentId?: string;
  isPremium: boolean;
}) {
  const account = useActiveAccount();
  const { membershipType, isLoading: membershipLoading } = useMembership();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);

  // Tear down audio + object URL on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  // Resolve whether this viewer is allowed to listen — same rule as reading.
  useEffect(() => {
    let cancelled = false;

    async function resolveAccess() {
      // Free articles are open to everyone (signed in or not)
      if (!isPremium) {
        setAllowed(true);
        return;
      }
      // Premium articles require a signed-in user
      if (!account?.address) {
        setAllowed(false);
        return;
      }
      // Wait for membership status before deciding
      if (membershipLoading) return;
      // Premium members get every article
      if (membershipType === 'premium') {
        setAllowed(true);
        return;
      }
      // Freemium / unknown: allow only within the read limit (read-only check)
      try {
        const res = await fetch('/api/track-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_address: account.address.toLowerCase(),
            story_slug: contentId || slug,
            checkOnly: true,
          }),
        });
        const result = await res.json();
        if (cancelled) return;
        setAllowed(Boolean(result.alreadyRead));
      } catch {
        if (!cancelled) setAllowed(false);
      }
    }

    resolveAccess();
    return () => {
      cancelled = true;
    };
  }, [isPremium, account?.address, membershipType, membershipLoading, slug]);

  async function buildAudio(): Promise<HTMLAudioElement> {
    const res = await fetch('/api/demeter/article-summary-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) throw new Error('Failed to generate audio summary');

    const url = URL.createObjectURL(await res.blob());
    urlRef.current = url;

    const audio = new Audio(url);
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.onended = () => {
      audio.currentTime = 0;
      setProgress(0);
      setStatus('paused');
    };
    audioRef.current = audio;
    return audio;
  }

  async function toggle() {
    setError(false);
    try {
      if (status === 'playing') {
        audioRef.current?.pause();
        setStatus('paused');
        return;
      }
      if (audioRef.current) {
        await audioRef.current.play();
        setStatus('playing');
        return;
      }
      setStatus('loading');
      const audio = await buildAudio();
      await audio.play();
      setStatus('playing');
    } catch {
      setError(true);
      setStatus('idle');
    }
  }

  const loading = status === 'loading';
  const playing = status === 'playing';

  // Only render once the viewer is confirmed allowed to access this article
  if (allowed !== true) return null;

  return (
    <div className="mb-10 w-fit max-w-full">
      <div className="flex items-center gap-3 border border-gray-200 rounded-full pl-2 pr-6 py-2 bg-white hover:border-gray-400 transition-colors">
        <button
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? 'Pause summary' : 'Play summary of this article'}
          className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition disabled:opacity-70 shrink-0"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : playing ? (
            <Pause size={18} />
          ) : (
            <Play size={18} className="ml-0.5" />
          )}
        </button>

        <div className="min-w-0">
          <div className="font-georgia-pro text-sm text-gray-900 leading-snug">
            {loading ? 'Generating summary…' : 'Listen to a summary of this article'}
          </div>
          <div className="font-georgia-pro text-xs text-gray-500 leading-snug">
            {error ? "Couldn't generate audio — tap to retry" : 'Narrated by Demeter'}
          </div>
        </div>
      </div>

      {/* Progress track (appears once audio exists) */}
      {audioRef.current && (
        <div className="mt-2 h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-black transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
