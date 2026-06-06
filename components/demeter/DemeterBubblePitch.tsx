'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Split Demeter's reply from the suggested follow-up questions */
function parseReply(text: string): { reply: string; suggestions: string[] } {
  const marker = /you might also ask[:\s]*/i;
  const idx = text.search(marker);
  if (idx === -1) return { reply: text.trim(), suggestions: [] };

  const replyPart = text.slice(0, idx).trim();
  const suggestionPart = text.slice(idx);
  const suggestions = [...suggestionPart.matchAll(/•\s*(.+)/g)].map((m) =>
    m[1].trim(),
  );
  return { reply: replyPart, suggestions };
}

export function DemeterBubblePitch() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function resetTextareaHeight() {
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;

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
          slug: 'ff-pitch-deck',
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
    <div className="flex flex-col w-full bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ height: '480px' }}>
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-black text-white shrink-0">
        <span className="font-adonis text-lg tracking-wide">Demeter</span>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <p className="font-georgia-pro text-sm text-gray-400 text-center pt-4">
            Ask me anything about Knead — the platform, memberships, Demeter, or the raise.
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

          const { reply, suggestions } = parseReply(msg.content);
          return (
            <div key={i} className="flex flex-col gap-2">
              <div className="bg-gray-50 text-gray-900 text-sm font-georgia-pro rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[88%] leading-relaxed whitespace-pre-wrap">
                {reply}
              </div>
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
          placeholder="Ask about Knead…"
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
  );
}
