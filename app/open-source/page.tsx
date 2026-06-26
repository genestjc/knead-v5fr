'use client';

import { useState, useRef, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Header } from '@/components/header';
import { RECIPES, FREE_TURNS_PER_DAY, type RecipeId, type BuildRecipe } from '@/lib/build-recipes';

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

type View = 'landing' | 'menu' | 'chat';

function BuildUI({ walletAddress }: { walletAddress?: string }) {
  const [view, setView] = useState<View>('landing');
  const [selectedRecipes, setSelectedRecipes] = useState<RecipeId[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnsLeft, setTurnsLeft] = useState<number>(FREE_TURNS_PER_DAY);
  const [zipProposal, setZipProposal] = useState<ZipProposal | null>(null);
  const [zipping, setZipping] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleRecipe = (id: RecipeId) => {
    setSelectedRecipes((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || rateLimited) return;
    setView('chat');

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
          { role: 'assistant', content: `You've used your ${FREE_TURNS_PER_DAY} free turns today. [Upgrade to Knead Monthly](/join) for unlimited builds.` },
        ]);
        return;
      }

      const data = await res.json();
      if (data.reply) setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (typeof data.turnsLeft === 'number') setTurnsLeft(data.turnsLeft);
      if (data.zipProposal) setZipProposal(data.zipProposal);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
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


  const startWithRecipe = (recipe: BuildRecipe) => {
    if (!selectedRecipes.includes(recipe.id)) setSelectedRecipes((prev) => [...prev, recipe.id]);
    sendMessage(`I want to build a ${recipe.title}: ${recipe.description}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <Header />

      {/* ── Landing ─────────────────────────────────────────────────────────── */}
      {view === 'landing' && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in-up">
          <div className="w-full max-w-2xl">
            <h1 className="font-adonis text-4xl md:text-5xl text-black text-center mb-3">
              What would you like to build?
            </h1>
            <p className="font-georgia-pro text-gray-400 text-center mb-10 text-base">
              Describe it to Demeter, or{' '}
              <button
                onClick={() => setView('menu')}
                className="underline underline-offset-2 hover:text-black transition-colors"
              >
                browse the menu
              </button>
              .
            </p>

            <ChatInput
              inputRef={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={() => sendMessage(input)}
              onKeyDown={handleKeyDown}
              loading={loading}
              disabled={rateLimited}
              placeholder="Describe what you want to build from Knead's stack…"
            />

            {/* Suggestion pills */}
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {([
                { id: 'paywalled-blog', label: 'Paywalled Content' },
                { id: 'streaming', label: 'Streaming' },
                { id: 'e2e-chat', label: 'End-To-End Encrypted Chat' },
                { id: 'asset-builder', label: 'Agentic Assistance' },
              ] as { id: RecipeId; label: string }[]).map(({ id, label }) => {
                const r = RECIPES.find((x) => x.id === id)!;
                return (
                  <button
                    key={id}
                    onClick={() => startWithRecipe(r)}
                    className="text-xs font-georgia-pro border border-gray-200 rounded-full px-4 py-2 text-gray-500 hover:border-black hover:text-black transition-colors"
                  >
                    {label}
                  </button>
                );
              })}
              <button
                onClick={() => setView('menu')}
                className="text-xs font-georgia-pro border border-gray-200 rounded-full px-4 py-2 text-gray-500 hover:border-black hover:text-black transition-colors"
              >
                See all →
              </button>
            </div>

            <p className="font-georgia-pro italic text-gray-400 text-sm text-center mt-5">
              Knead's stack is completely open source. Learn to build anything from our repository.
            </p>
          </div>
        </div>
      )}

      {/* ── Menu ────────────────────────────────────────────────────────────── */}
      {view === 'menu' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Menu header */}
          <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setView('landing')}
              className="font-georgia-pro text-sm text-gray-400 hover:text-black transition-colors"
            >
              ← Back
            </button>
            <span className="font-adonis text-sm tracking-widest uppercase text-gray-400">The Menu</span>
            <div className="w-12" />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-100">
              {RECIPES.map((recipe, i) => (
                <MenuTile
                  key={recipe.id}
                  recipe={recipe}
                  index={i}
                  selected={selectedRecipes.includes(recipe.id)}
                  onToggle={() => toggleRecipe(recipe.id)}
                  onOrder={() => startWithRecipe(recipe)}
                />
              ))}
            </div>

            {selectedRecipes.length > 0 && (
              <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipes.map((id) => {
                    const r = RECIPES.find((x) => x.id === id)!;
                    return (
                      <span key={id} className="flex items-center gap-1 text-xs font-georgia-pro bg-gray-100 rounded-full px-3 py-1">
                        {r.title}
                        <button className="ml-1 text-gray-400 hover:text-black" onClick={() => toggleRecipe(id)}>×</button>
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => sendMessage(`I want to build: ${selectedRecipes.map((id) => RECIPES.find((r) => r.id === id)?.title).join(', ')}`)}
                  className="shrink-0 ml-4 bg-black text-white font-georgia-pro text-sm px-5 py-2 rounded-full hover:bg-gray-800 transition-colors"
                >
                  Build these →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat ────────────────────────────────────────────────────────────── */}
      {view === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="shrink-0 border-b border-gray-50 px-4 py-2 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setMessages([]); setView('landing'); }}
              className="font-georgia-pro text-xs text-gray-400 hover:text-black transition-colors mr-2"
            >
              ← New
            </button>
            {selectedRecipes.map((id) => {
              const r = RECIPES.find((x) => x.id === id)!;
              return (
                <span key={id} className="flex items-center gap-1 text-xs font-georgia-pro bg-gray-100 rounded-full px-3 py-1">
                  {r.title}
                  <button className="ml-1 text-gray-400 hover:text-black" onClick={() => toggleRecipe(id)}>×</button>
                </span>
              );
            })}
            {turnsLeft < FREE_TURNS_PER_DAY && !rateLimited && (
              <span className="text-xs font-georgia-pro text-gray-300 ml-auto">
                {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="max-w-[85%]">
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm font-georgia-pro text-gray-800 whitespace-pre-wrap">
                        <MessageContent content={msg.content} />
                      </div>
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

          {/* Input */}
          <div className="shrink-0 border-t border-gray-100 px-4 py-4">
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
                  <a href="/join" className="underline hover:text-black">Upgrade to Knead Monthly</a> for unlimited builds.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Menu tile ────────────────────────────────────────────────────────────────

function MenuTile({ recipe, index, selected, onToggle, onOrder }: {
  recipe: BuildRecipe; index: number; selected: boolean; onToggle: () => void; onOrder: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`relative border-r border-b border-gray-100 p-6 cursor-pointer transition-colors duration-200 ${
        selected ? 'bg-black' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {/* Number */}
      <p className={`font-adonis text-xs tracking-widest mb-3 ${selected ? 'text-gray-600' : 'text-gray-300'}`}>
        {String(index + 1).padStart(2, '0')}
      </p>

      {/* Title */}
      <h3 className={`font-adonis text-lg leading-tight mb-2 ${selected ? 'text-white' : 'text-black'}`}>
        {recipe.title}
      </h3>

      {/* Description */}
      <p className={`font-georgia-pro text-xs leading-relaxed ${selected ? 'text-gray-400' : 'text-gray-400'}`}>
        {recipe.description}
      </p>

      {/* Build button */}
      <button
        onClick={(e) => { e.stopPropagation(); onOrder(); }}
        className={`mt-4 text-xs font-georgia-pro underline underline-offset-2 transition-colors ${
          selected ? 'text-white hover:text-gray-300' : 'text-gray-400 hover:text-black'
        }`}
      >
        Build this →
      </button>

      {selected && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white" />
      )}
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
