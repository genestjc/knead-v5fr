'use client';

/**
 * Live demo: a Knead article with Demeter and the audio summary on it.
 *
 * The article panel is a reproduction of the reading experience, not an iframe
 * of the post page — a full magazine page in a slide-sized frame is a scrolly
 * mess, and a premium post would show the paywall instead of the story. What
 * matters is that everything that *responds* is real: both panels call the
 * production routes with the real slug, and the answers come back from the
 * live CMS-grounded agent.
 *
 * The audio player surfaces the `X-Audio-Cache` header, which the product's
 * own button deliberately hides. In a deck it's the whole point: the first
 * listen pays for a summary and a narration, every later one is a cache hit.
 */
import { useEffect, useRef, useState } from 'react';
import type { DemoArticle } from '@/lib/deck-demo-article';
import { ChatInput, ChatLog, LiveBadge, Starters, postChat, useDemoChat } from './deck-chat';

const STARTERS = [
  'What is this piece actually about?',
  'Who is the subject, in one line?',
  'What else has Knead published like this?',
];

export function DemoDemeter({ article }: { article: DemoArticle | null }) {
  const chat = useDemoChat((text, history) =>
    postChat('/api/demeter/chat', { message: text, slug: article?.slug, history }),
  );

  return (
    <div className="grid lg:grid-cols-[1.05fr_1fr] gap-px bg-white/10 border border-white/10 w-full">
      <ArticlePanel article={article} />

      {/* min-w-0: a grid item defaults to min-width:auto, so the URL bar and
          the starter chips would otherwise push the column past the screen.
          print:hidden: on paper this is an empty transcript box that says
          nothing, and the two-column grid fragments across two pages. */}
      <div className="bg-black p-5 md:p-6 flex flex-col min-w-0 min-h-[380px] print:hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="font-adonis text-lg text-white leading-none mb-1.5">Demeter</p>
            <LiveBadge>Live · /api/demeter/chat</LiveBadge>
          </div>
        </div>

        {chat.messages.length === 0 && (
          <p className="font-georgia-pro text-[13px] text-white/45 leading-relaxed mb-4">
            {article
              ? 'Ask about the story. Demeter reads it out of the CMS before answering, and searches the web when the question runs past what the piece says.'
              : 'The CMS did not answer just now, so Demeter is running without an article loaded. It still answers from the archive.'}
          </p>
        )}

        {/* The log only takes space once there's a thread — an empty scroll
            pane above the starters just reads as a hole in the slide. */}
        {(chat.messages.length > 0 || chat.loading) && (
          <ChatLog
            messages={chat.messages}
            loading={chat.loading}
            loadingNote="reading the article…"
            className="flex-1 h-[180px] md:h-[200px] mb-3"
          />
        )}

        {chat.messages.length === 0 && (
          <div className="mt-auto mb-3">
            <Starters prompts={STARTERS} onPick={chat.submit} disabled={chat.loading} />
          </div>
        )}

        <ChatInput
          value={chat.input}
          onChange={chat.setInput}
          onSubmit={() => chat.submit(chat.input)}
          disabled={chat.loading}
          placeholder={chat.loading ? 'Thinking…' : 'Ask Demeter about this story…'}
        />
      </div>

      <p className="hidden print:block bg-black p-6 font-georgia-pro text-sm text-white/50 leading-relaxed">
        Demeter sits alongside this story in the browser version of the deck, answering from the
        piece itself — and the summary above is written and narrated on demand.
      </p>
    </div>
  );
}

// ─── The article side ─────────────────────────────────────────────────────────

function ArticlePanel({ article }: { article: DemoArticle | null }) {
  if (!article) {
    return (
      <div className="bg-black p-5 md:p-6 flex items-center">
        <p className="font-georgia-pro text-sm text-white/40 leading-relaxed">
          The article could not be loaded from the CMS just now. Demeter, on the right, is still
          live.
        </p>
      </div>
    );
  }

  const published = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="bg-black p-5 md:p-6 flex flex-col min-w-0">
      {/* Browser chrome — says "this is a page on the site", without pretending
          to be a screenshot of one. */}
      <div className="flex items-center gap-2 mb-4">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2 h-2 rounded-full bg-white/15" />
          <span className="w-2 h-2 rounded-full bg-white/15" />
          <span className="w-2 h-2 rounded-full bg-white/15" />
        </span>
        <span className="flex-1 min-w-0 truncate font-mono text-[10px] text-white/30 bg-white/[0.04] border border-white/10 rounded px-2 py-1">
          kneadmag.com/posts/{article.slug}
        </span>
      </div>

      {article.imageUrl && (
        // Sanity's CDN is on the CSP img-src allowlist. Plain <img> rather than
        // next/image: this is one decorative hero, not a gallery worth the
        // optimizer round trip.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="w-full h-28 md:h-32 object-cover rounded mb-4 opacity-90"
        />
      )}

      <h3 className="font-adonis text-2xl md:text-3xl text-white leading-tight mb-2">
        {article.title}
      </h3>

      <p className="font-georgia-pro text-[11px] text-white/35 mb-4">
        {[article.author, published].filter(Boolean).join(' · ')}
        {article.isPremium && ' · Members'}
      </p>

      <AudioSummary slug={article.slug} />

      {article.excerpt && (
        <p className="mt-4 font-georgia-pro text-[13px] text-white/50 leading-relaxed line-clamp-4">
          {article.excerpt}
        </p>
      )}

      <a
        href={`/posts/${article.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto pt-4 font-georgia-pro text-[11px] text-white/40 hover:text-white transition-colors"
      >
        Read it on the site ↗
      </a>
    </div>
  );
}

// ─── Audio summary ────────────────────────────────────────────────────────────

/**
 * `ready` is the state that matters on a phone: iOS only lets audio start
 * inside a user gesture, and ours is spent by the time the summary has been
 * written and narrated. When the automatic start is refused we keep the loaded
 * audio and wait — the visitor's second tap is a fresh gesture and works.
 */
type AudioState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

function AudioSummary({ slug }: { slug: string }) {
  const [state, setState] = useState<AudioState>('idle');
  const [cache, setCache] = useState<'hit' | 'miss' | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  /** Start an already-loaded clip. Playback refusal is not a generation failure. */
  const play = async (audio: HTMLAudioElement) => {
    try {
      await audio.play();
      setState('playing');
    } catch {
      setState('ready');
    }
  };

  const toggle = async () => {
    if (state === 'playing') {
      audioRef.current?.pause();
      setState('paused');
      return;
    }
    if ((state === 'paused' || state === 'ready') && audioRef.current) {
      await play(audioRef.current);
      return;
    }

    setState('loading');
    setError(null);

    let audio: HTMLAudioElement;
    try {
      const res = await fetch('/api/demeter/article-summary-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || 'Could not generate the summary.');
      }

      setCache(res.headers.get('X-Audio-Cache') === 'hit' ? 'hit' : 'miss');
      const raw = res.headers.get('X-Summary');
      if (raw) setSummary(decodeURIComponent(raw));

      const url = URL.createObjectURL(await res.blob());
      urlRef.current = url;

      audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the summary.');
      setState('error');
      return;
    }

    await play(audio);
  };

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={toggle}
          disabled={state === 'loading'}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 font-georgia-pro text-[12px] text-white/80 hover:text-white hover:border-white/50 transition-colors disabled:opacity-50"
        >
          <span aria-hidden>{state === 'playing' ? '❚❚' : '▶'}</span>
          {state === 'loading'
            ? 'Writing and narrating…'
            : state === 'playing'
            ? 'Pause'
            : state === 'paused'
            ? 'Resume'
            : state === 'ready'
            ? 'Play the summary'
            : 'Listen to a summary'}
        </button>

        {cache && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">
            X-Audio-Cache: {cache}
            <span className="text-white/25">
              {cache === 'miss' ? ' · written + narrated now' : ' · served from store'}
            </span>
          </span>
        )}
      </div>

      {state === 'loading' && (
        <p className="mt-2 font-georgia-pro text-[11px] text-white/30">
          First listen writes the summary and narrates it — around fifteen seconds. Every listen
          after this one is a cache hit.
        </p>
      )}

      {state === 'ready' && (
        <p className="mt-2 font-georgia-pro text-[11px] text-white/35">
          Written and narrated — tap play to hear it.
        </p>
      )}

      {error && <p className="mt-2 font-georgia-pro text-[11px] text-red-400/80">{error}</p>}

      {summary && (
        <p className="mt-3 font-georgia-pro text-[12px] text-white/45 leading-relaxed line-clamp-3 border-l border-white/15 pl-3">
          {summary}
        </p>
      )}
    </div>
  );
}
