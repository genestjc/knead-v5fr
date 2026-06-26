'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Header } from '@/components/header';
import { RECIPES, FREE_TURNS_PER_DAY, type RecipeId, type BuildRecipe } from '@/lib/build-recipes';

// ─── Main page ────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ZipProposal {
  files: { path: string; source: 'repo' | 'generated'; content?: string }[];
  setupInstructions: string;
}

export default function OpenSourcePage() {
  const account = useActiveAccount();
  return <BuildUI walletAddress={account?.address} />;
}

// ─── Build UI ─────────────────────────────────────────────────────────────────

function BuildUI({ walletAddress }: { walletAddress?: string }) {
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeId[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnsLeft, setTurnsLeft] = useState<number>(FREE_TURNS_PER_DAY);
  const [zipProposal, setZipProposal] = useState<ZipProposal | null>(null);
  const [zipping, setZipping] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Sync scroll position → activeIdx
  const onCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIdx(idx);
  }, []);

  const scrollTo = useCallback((idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setActiveIdx(idx);
  }, []);

  const prev = () => scrollTo(Math.max(0, activeIdx - 1));
  const next = () => scrollTo(Math.min(RECIPES.length - 1, activeIdx + 1));

  const toggleRecipe = (id: RecipeId) => {
    setSelectedRecipes((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || rateLimited) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const history = [...messages];
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/open-source/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history,
          recipeIds: selectedRecipes,
          walletAddress,
          zipProposal,
        }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `You've used your ${FREE_TURNS_PER_DAY} free turns today. [Upgrade to Knead Monthly](/join) for unlimited builds.`,
          },
        ]);
        return;
      }

      const data = await res.json();
      if (data.reply) setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (typeof data.turnsLeft === 'number') setTurnsLeft(data.turnsLeft);
      if (data.zipProposal) setZipProposal(data.zipProposal);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = async () => {
    if (!zipProposal) return;
    setZipping(true);
    try {
      const res = await fetch('/api/open-source/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zipProposal),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knead-starter.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not generate ZIP. Please try again.');
    } finally {
      setZipping(false);
    }
  };

  const speakMessage = async (text: string, idx: number) => {
    if (speakingMsgIdx === idx) { setSpeakingMsgIdx(null); return; }
    setSpeakingMsgIdx(idx);
    try {
      const res = await fetch('/api/demeter/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.replace(/[#*`[\]]/g, '').slice(0, 1000) }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setSpeakingMsgIdx(null); URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setSpeakingMsgIdx(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const startWithRecipe = (recipe: BuildRecipe) => {
    if (!selectedRecipes.includes(recipe.id)) setSelectedRecipes((prev) => [...prev, recipe.id]);
    sendMessage(`I want to build a ${recipe.title}: ${recipe.description}`);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const showMenu = messages.length === 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <Header />

      {showMenu ? (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Full-bleed tile carousel */}
          <div className="flex-1 relative overflow-hidden">
            <div
              ref={carouselRef}
              onScroll={onCarouselScroll}
              className="flex h-full overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {RECIPES.map((recipe, i) => (
                <FullBleedTile
                  key={recipe.id}
                  recipe={recipe}
                  index={i}
                  selected={selectedRecipes.includes(recipe.id)}
                  onToggle={() => toggleRecipe(recipe.id)}
                  onOrder={() => startWithRecipe(recipe)}
                />
              ))}
            </div>

            {/* Left arrow */}
            {activeIdx > 0 && (
              <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:border-black transition-colors z-10"
                aria-label="Previous"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {/* Right arrow */}
            {activeIdx < RECIPES.length - 1 && (
              <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:border-black transition-colors z-10"
                aria-label="Next"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}

            {/* Dot indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {RECIPES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIdx ? 'w-4 h-1.5 bg-black' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-500'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom — title, description, input */}
          <div className="shrink-0 border-t border-gray-100 px-6 md:px-12 pt-6 pb-6">
            <div className="max-w-2xl mx-auto">
              <h1 className="font-adonis text-2xl md:text-3xl text-black mb-1 animate-fade-in-up">
                Ask Demeter what you&apos;d like to build.
              </h1>
              <p className="font-georgia-pro text-gray-500 text-sm mb-4 animate-fade-in-up-delay">
                Anything from our stack — paywalled blog, streaming, live video, encrypted chat — yours to build.
              </p>

              {selectedRecipes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedRecipes.map((id) => {
                    const r = RECIPES.find((x) => x.id === id)!;
                    return (
                      <span key={id} className="flex items-center gap-1 text-xs font-georgia-pro bg-gray-100 rounded-full px-3 py-1">
                        {r.emoji} {r.title}
                        <button className="ml-1 text-gray-400 hover:text-black" onClick={() => toggleRecipe(id)}>×</button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="animate-fade-in-up-delay-2">
                <ChatInput
                  inputRef={inputRef}
                  value={input}
                  onChange={setInput}
                  onSubmit={() => sendMessage(input)}
                  onKeyDown={handleKeyDown}
                  loading={loading}
                  disabled={rateLimited}
                  placeholder="Describe what you want to build…"
                />
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* ─── Chat view ─────────────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Selected recipe chips + zip banner */}
          {(selectedRecipes.length > 0 || zipProposal) && (
            <div className="shrink-0 border-b border-gray-50 px-6 py-2 flex flex-wrap items-center gap-2">
              {selectedRecipes.map((id) => {
                const r = RECIPES.find((x) => x.id === id)!;
                return (
                  <span key={id} className="flex items-center gap-1 text-xs font-georgia-pro bg-gray-100 rounded-full px-3 py-1">
                    {r.emoji} {r.title}
                    <button className="ml-1 text-gray-400 hover:text-black" onClick={() => toggleRecipe(id)}>×</button>
                  </span>
                );
              })}
              {turnsLeft < FREE_TURNS_PER_DAY && !rateLimited && (
                <span className="text-xs font-georgia-pro text-gray-400 ml-auto">
                  {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left today
                </span>
              )}
              {zipProposal && (
                <button
                  onClick={downloadZip}
                  disabled={zipping}
                  className="ml-auto flex items-center gap-1.5 bg-black text-white text-xs font-georgia-pro px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {zipping ? 'Building…' : '⬇ Download Starter'}
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex flex-col gap-1 max-w-[85%]">
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm font-georgia-pro text-gray-800 whitespace-pre-wrap">
                        <MessageContent content={msg.content} />
                      </div>
                      <button
                        onClick={() => speakMessage(msg.content, i)}
                        className="text-left text-xs font-georgia-pro text-gray-300 hover:text-gray-500 transition-colors pl-1"
                      >
                        {speakingMsgIdx === i ? '⏸ stop' : '🔊 listen'}
                      </button>
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="bg-black text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-georgia-pro max-w-[85%] whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Bottom input */}
          <div className="shrink-0 border-t border-gray-100 px-4 md:px-8 py-4">
            <div className="max-w-2xl mx-auto">
              <ChatInput
                inputRef={inputRef}
                value={input}
                onChange={setInput}
                onSubmit={() => sendMessage(input)}
                onKeyDown={handleKeyDown}
                loading={loading}
                disabled={rateLimited}
                placeholder={rateLimited ? 'Daily limit reached — upgrade for unlimited builds' : 'Ask a follow-up…'}
              />
              {rateLimited && (
                <p className="text-center text-xs font-georgia-pro text-gray-400 mt-2">
                  <a href="/join" className="underline hover:text-black">Upgrade to Knead Monthly</a>{' '}
                  for unlimited builds.
                </p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Full-bleed tile ──────────────────────────────────────────────────────────

function FullBleedTile({ recipe, index, selected, onToggle, onOrder }: {
  recipe: BuildRecipe; index: number; selected: boolean; onToggle: () => void; onOrder: () => void;
}) {
  const isEven = index % 2 === 0;

  return (
    <div
      className={`snap-center shrink-0 w-full h-full flex flex-col justify-between p-8 md:p-16 cursor-pointer transition-colors duration-300 ${
        selected
          ? 'bg-black text-white'
          : isEven
          ? 'bg-white text-black'
          : 'bg-[#f8f7f4] text-black'
      }`}
      onClick={onToggle}
    >
      {/* Top — index number */}
      <div className={`font-adonis text-sm tracking-widest uppercase ${selected ? 'text-gray-500' : 'text-gray-300'}`}>
        0{index + 1}
      </div>

      {/* Middle — main content */}
      <div className="flex-1 flex flex-col justify-center max-w-xl">
        <p className={`text-4xl mb-6 ${selected ? '' : ''}`}>{recipe.emoji}</p>
        <h2 className={`font-adonis text-4xl md:text-6xl leading-tight mb-4 ${selected ? 'text-white' : 'text-black'}`}>
          {recipe.title}
        </h2>
        <div className={`w-12 h-px mb-4 ${selected ? 'bg-gray-600' : 'bg-gray-200'}`} />
        <p className={`font-georgia-pro text-base md:text-lg leading-relaxed ${selected ? 'text-gray-300' : 'text-gray-500'}`}>
          {recipe.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-6">
          {recipe.tags.map((t) => (
            <span
              key={t}
              className={`text-xs font-georgia-pro uppercase tracking-wider px-3 py-1 border rounded-full ${
                selected ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-400'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom — action */}
      <div className="flex items-center justify-between">
        <span className={`font-georgia-pro text-xs uppercase tracking-widest ${selected ? 'text-gray-500' : 'text-gray-300'}`}>
          {selected ? 'Selected' : 'Tap to select'}
        </span>
        <button
          className={`font-adonis text-sm px-6 py-2.5 rounded-full border transition-colors ${
            selected
              ? 'border-white text-white hover:bg-white hover:text-black'
              : 'border-black text-black hover:bg-black hover:text-white'
          }`}
          onClick={(e) => { e.stopPropagation(); onOrder(); }}
        >
          Build this →
        </button>
      </div>
    </div>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function ChatInput({ inputRef, value, onChange, onSubmit, onKeyDown, loading, disabled, placeholder }: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  value: string; onChange: (v: string) => void; onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  loading: boolean; disabled: boolean; placeholder: string;
}) {
  return (
    <div className="flex items-end gap-2 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-gray-400 transition-colors bg-white">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        className="flex-1 resize-none outline-none text-sm font-georgia-pro text-black placeholder-gray-300 bg-transparent leading-relaxed disabled:opacity-50"
        style={{ minHeight: '24px', maxHeight: '160px' }}
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim() || loading || disabled}
        className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-30"
      >
        {loading ? (
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1l6 6-6 6M13 7H1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Message content renderer ─────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w+\n/, '');
          return <pre key={i} className="bg-gray-100 rounded-lg p-3 text-xs overflow-x-auto my-2 font-mono">{code}</pre>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
