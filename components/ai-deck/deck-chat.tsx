'use client';

/**
 * Chat primitives shared by the deck's live demos.
 *
 * Both demo panels talk to real production routes, so they need the same
 * things: a transcript that scrolls without stealing the deck's scroll, a
 * pending state honest about how long a tool-calling turn takes, and starter
 * prompts so a visitor who doesn't know what to ask still sees the thing work.
 */
import { useEffect, useRef, useState } from 'react';
import { ACCENT } from './theme';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A transcript pane. Scrolls internally; never chains into the deck. */
export function ChatLog({
  messages,
  loading,
  loadingNote,
  className = '',
}: {
  messages: ChatMessage[];
  loading: boolean;
  loadingNote?: string;
  className?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `nearest` keeps the scroll inside the log — `smooth`/`center` would drag
    // the whole snapping deck along with it.
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, loading]);

  return (
    <div className={`overflow-y-auto overscroll-contain space-y-3 pr-1 ${className}`}>
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={
              msg.role === 'user'
                ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-white text-black px-3.5 py-2.5 font-georgia-pro text-[13px] leading-relaxed whitespace-pre-wrap'
                : 'max-w-[90%] rounded-2xl rounded-tl-sm bg-white/[0.07] border border-white/10 text-white/85 px-3.5 py-2.5 font-georgia-pro text-[13px] leading-relaxed whitespace-pre-wrap'
            }
            style={{ overflowWrap: 'anywhere' }}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] border border-white/10 px-3.5 py-3 flex items-center gap-2">
            <Dots />
            {loadingNote && (
              <span className="font-georgia-pro text-[11px] text-white/35">{loadingNote}</span>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function Dots() {
  return (
    <span className="flex gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/** Starter questions. They disappear once the visitor has their own thread going. */
export function Starters({
  prompts,
  onPick,
  disabled,
}: {
  prompts: string[];
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {prompts.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          disabled={disabled}
          className="text-left font-georgia-pro text-[11px] text-white/55 border border-white/15 rounded-full px-3 py-1.5 hover:text-white hover:border-white/40 transition-colors disabled:opacity-40"
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex items-end gap-2 border border-white/15 rounded-2xl px-3 py-2 focus-within:border-white/40 transition-colors">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
          // Arrows and space belong to the text field here, not to the deck.
          e.stopPropagation();
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent outline-none font-georgia-pro text-[13px] text-white placeholder-white/25 leading-relaxed py-1 disabled:opacity-50"
        style={{ minHeight: '28px', maxHeight: '96px' }}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="shrink-0 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/80 transition-colors disabled:opacity-25"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1l6 6-6 6M13 7H1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** "Live" marker. Every demo panel carries one — nobody should wonder. */
export function LiveBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-georgia-pro text-[10px] uppercase tracking-[0.18em] text-white/45">
      <span className="relative flex w-1.5 h-1.5">
        <span
          className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
          style={{ backgroundColor: ACCENT }}
        />
        <span
          className="relative inline-flex w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: ACCENT }}
        />
      </span>
      {children}
    </span>
  );
}

/**
 * One round-trip to a Knead chat route. Returns the reply text, or throws with
 * a message worth showing — a demo that fails silently is worse than one that
 * says the rate limit was hit.
 */
export async function postChat(
  url: string,
  body: Record<string, unknown>,
): Promise<{ reply: string; turnsLeft?: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        data?.message ||
          data?.error ||
          "That's the rate limit for this demo — give it a minute and try again.",
      );
    }
    throw new Error(data?.message || data?.error || 'The assistant could not respond just now.');
  }

  return { reply: data?.reply ?? '', turnsLeft: data?.turnsLeft };
}

/** Shared send-loop state for a demo panel. */
export function useDemoChat(
  send: (text: string, history: ChatMessage[]) => Promise<{ reply: string; turnsLeft?: number }>,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnsLeft, setTurnsLeft] = useState<number | null>(null);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const { reply, turnsLeft: left } = await send(trimmed, history);
      if (reply) setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (typeof left === 'number') setTurnsLeft(left);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return { messages, input, setInput, loading, turnsLeft, submit };
}
