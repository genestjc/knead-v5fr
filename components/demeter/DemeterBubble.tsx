'use client';

import { useState, useRef, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { X, Send, Loader2, Copy, Check, Volume2, Square } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DemeterBubbleProps {
  slug?: string;
  isPremiumPost?: boolean;
}

/** Split Demeter's reply into the answer, a shareable social post, and suggested follow-ups */
function parseReply(text: string): {
  reply: string;
  suggestions: string[];
  share: string | null;
} {
  // Pull out a [SHARE]...[/SHARE] block if present
  let share: string | null = null;
  let rest = text;
  const shareMatch = text.match(/\[SHARE\]([\s\S]*?)\[\/SHARE\]/i);
  if (shareMatch) {
    share = shareMatch[1].trim();
    rest = text.replace(shareMatch[0], '').trim();
  }

  const marker = /you might also ask[:\s]*/i;
  const idx = rest.search(marker);
  if (idx === -1) return { reply: rest.trim(), suggestions: [], share };

  const replyPart = rest.slice(0, idx).trim();
  const suggestionPart = rest.slice(idx);
  const suggestions = [...suggestionPart.matchAll(/•\s*(.+)/g)].map((m) =>
    m[1].trim(),
  );
  return { reply: replyPart, suggestions, share };
}

/** A crafted social post with one-tap share buttons */
function ShareCard({ text, slug }: { text: string; slug?: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? slug
        ? `${window.location.origin}/posts/${slug}`
        : window.location.href
      : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[88%] bg-white shadow-sm">
      <p className="text-sm font-georgia-pro text-gray-900 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-georgia-pro bg-black text-white rounded-lg px-3 py-1.5 hover:bg-gray-800 transition"
        >
          Share on X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-georgia-pro border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 hover:text-black transition"
        >
          Facebook
        </a>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs font-georgia-pro border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 hover:text-black transition"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export function DemeterBubble({ slug, isPremiumPost }: DemeterBubbleProps) {
  const account = useActiveAccount();
  const { membershipType } = useMembership();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Text-to-speech playback. Tracks which message index is loading/playing so
  // each Demeter reply gets its own Listen/Stop toggle.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [audioLoadingIdx, setAudioLoadingIdx] = useState<number | null>(null);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingIdx(null);
  }

  async function speak(text: string, idx: number) {
    // Tapping the active message stops it
    if (speakingIdx === idx) {
      stopAudio();
      return;
    }
    stopAudio(); // stop any other reply that's playing
    setAudioLoadingIdx(idx);

    try {
      const res = await fetch('/api/demeter/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('TTS failed');

      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        setSpeakingIdx((cur) => (cur === idx ? null : cur));
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;

      await audio.play();
      setSpeakingIdx(idx);
    } catch {
      stopAudio();
    } finally {
      setAudioLoadingIdx(null);
    }
  }

  // Stop narration when the panel closes or the component unmounts
  useEffect(() => {
    if (!open) stopAudio();
  }, [open]);
  useEffect(() => () => stopAudio(), []);

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Close when clicking/tapping outside
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function resetTextareaHeight() {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;

    if (!account) {
      setMessages((prev) => [...prev, { role: 'user', content: text.trim() }, { role: 'assistant', content: 'Sign in to chat with Demeter.' }]);
      setInput('');
      resetTextareaHeight();
      return;
    }

    // Premium articles: premium members always pass; freemium check their monthly read access
    if (isPremiumPost && membershipType !== 'premium') {
      try {
        const res = await fetch('/api/track-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_address: account.address.toLowerCase(), story_slug: slug, checkOnly: true }),
        });
        const result = await res.json();
        const hasArticleAccess = result.alreadyRead || (result.reads ?? 0) < 3;
        if (!hasArticleAccess) {
          setMessages((prev) => [...prev, { role: 'user', content: text.trim() }, { role: 'assistant', content: "You've used your 3 free articles this month. Upgrade to Knead Monthly for unlimited access." }]);
          setInput('');
          resetTextareaHeight();
          return;
        }
      } catch {
        // Fail open — don't block on a network error
      }
    }

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    resetTextareaHeight();
    setLoading(true);

    try {
      const res = await fetch('/api/demeter/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          slug,
          history: messages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't get a response. Try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={wrapperRef}>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-black text-white shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-adonis text-lg tracking-wide">Demeter</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <p className="font-georgia-pro text-sm text-gray-400 text-center pt-4">
                Ask me about this story or get the TLDR.
              </p>
            )}

            {messages.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="bg-black text-white text-sm font-georgia-pro rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const { reply, suggestions, share } = parseReply(msg.content);
              return (
                <div key={i} className="flex flex-col gap-2">
                  {reply && (
                    <div className="flex flex-col gap-1 max-w-[88%]">
                      <div className="bg-gray-50 text-gray-900 text-sm font-georgia-pro rounded-2xl rounded-tl-sm px-4 py-2.5 leading-relaxed whitespace-pre-wrap">
                        {reply}
                      </div>
                      <button
                        onClick={() => speak(reply, i)}
                        disabled={audioLoadingIdx === i}
                        className="flex items-center gap-1 text-xs font-georgia-pro text-gray-400 hover:text-black transition w-fit pl-1 disabled:opacity-60"
                        aria-label={speakingIdx === i ? 'Stop narration' : 'Listen to this reply'}
                      >
                        {audioLoadingIdx === i ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : speakingIdx === i ? (
                          <Square size={12} />
                        ) : (
                          <Volume2 size={12} />
                        )}
                        {audioLoadingIdx === i ? 'Loading…' : speakingIdx === i ? 'Stop' : 'Listen'}
                      </button>
                    </div>
                  )}
                  {share && <ShareCard text={share} slug={slug} />}
                  {suggestions.length > 0 && (
                    <div className="flex flex-col gap-1.5 pl-1">
                      {suggestions.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => send(s)}
                          className="text-left text-xs font-georgia-pro text-gray-500 hover:text-black border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1.5 transition w-fit max-w-[88%]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs font-georgia-pro">Thinking…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 py-3 border-t border-gray-100 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                if (!isTouch && e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about this story…"
              disabled={loading}
              className="flex-1 text-sm font-georgia-pro bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-50 resize-none overflow-y-auto"
              style={{ minHeight: '38px', maxHeight: '120px' }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="p-2 bg-black text-white rounded-xl hover:bg-gray-800 transition disabled:opacity-40 flex-shrink-0 mb-0.5"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bubble trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition flex items-center justify-center font-adonis text-lg"
        aria-label="Chat with Demeter"
      >
        {open ? <X size={20} /> : <img src="/demeter-icon.png" alt="D" width={32} height={32} className="object-contain" />}
      </button>
    </div>
  );
}
