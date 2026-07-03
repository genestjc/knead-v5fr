'use client';

import { useState, useRef, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Header } from '@/components/header';
import { RECIPES, FREE_TURNS_PER_DAY, type RecipeId, type BuildRecipe } from '@/lib/build-recipes';
import { PaywallModal } from '@/components/PaywallModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// User-selectable models for the build chat. Sonnet 5 is the default; the
// unpicked provider serves as the automatic fallback server-side.
const MODELS = [
  { id: 'sonnet-5', label: 'Sonnet 5', full: 'Claude Sonnet 5' },
  { id: 'gpt-5', label: 'GPT-5', full: 'OpenAI GPT-5' },
] as const;
type ModelId = (typeof MODELS)[number]['id'];
const MODEL_STORAGE_KEY = 'knead-build-model';

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
  const [showPaywall, setShowPaywall] = useState(false);
  const [model, setModel] = useState<ModelId>('sonnet-5');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Restore the visitor's last model choice (post-mount to avoid SSR mismatch)
  useEffect(() => {
    const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (MODELS.some((m) => m.id === saved)) setModel(saved as ModelId);
  }, []);

  const changeModel = (m: ModelId) => {
    setModel(m);
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, m);
    } catch {
      // private browsing — the choice just won't persist
    }
  };

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
          model,
        }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        if (!walletAddress) {
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Please sign in to continue.' }]);
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: `You've used your ${FREE_TURNS_PER_DAY} free turns for today.` }]);
          setShowPaywall(true);
        }
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
      {view !== 'menu' && <Header />}

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
              model={model}
              onModelChange={changeModel}
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

            <p className="font-georgia-pro italic text-gray-400 text-sm text-center mt-10">
              Knead's stack is completely open source. Learn to build anything from our repository.
            </p>
          </div>
        </div>
      )}

      {/* ── Menu ────────────────────────────────────────────────────────────── */}
      {view === 'menu' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-black">
          {/* Menu header — no site Header, title centered, back button left */}
          <div className="shrink-0 px-6 py-5 relative flex items-center justify-center">
            <button
              onClick={() => setView('landing')}
              className="absolute left-6 font-georgia-pro text-sm text-white/40 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <span className="font-adonis text-xl tracking-widest uppercase text-white">The Menu</span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4">
              {RECIPES.map((recipe, i) => (
                <FlipTile
                  key={recipe.id}
                  recipe={recipe}
                  index={i}
                  selected={selectedRecipes.includes(recipe.id)}
                  onSelect={() => toggleRecipe(recipe.id)}
                  onOrder={() => startWithRecipe(recipe)}
                />
              ))}
            </div>

            {selectedRecipes.length > 0 && (
              <div className="sticky bottom-0 border-t border-white/10 bg-black px-6 py-4 flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipes.map((id) => {
                    const r = RECIPES.find((x) => x.id === id)!;
                    return (
                      <span key={id} className="flex items-center gap-1 text-xs font-georgia-pro bg-white/10 text-white rounded-full px-3 py-1">
                        {r.title}
                        <button className="ml-1 text-white/40 hover:text-white" onClick={() => toggleRecipe(id)}>×</button>
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => sendMessage(`I want to build: ${selectedRecipes.map((id) => RECIPES.find((r) => r.id === id)?.title).join(', ')}`)}
                  className="shrink-0 ml-4 bg-white text-black font-georgia-pro text-sm px-5 py-2 rounded-full hover:bg-gray-100 transition-colors"
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
              <button
                onClick={() => setShowPaywall(true)}
                className="relative group text-xs font-georgia-pro text-gray-300 hover:text-gray-500 ml-auto transition-colors"
              >
                {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left
                <span className="pointer-events-none absolute bottom-full right-0 mb-2 w-64 bg-black text-white text-xs font-georgia-pro rounded-xl px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed z-10">
                  Free members get {FREE_TURNS_PER_DAY} turns a day to pull from Knead's stack. Sign up for Knead Monthly for unlimited use.
                </span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="max-w-[85%] min-w-0">
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm font-georgia-pro text-gray-800 whitespace-pre-wrap overflow-hidden" style={{ overflowWrap: 'anywhere' }}>
                        <MessageContent content={msg.content} />
                      </div>
                      {zipProposal && i === messages.length - 1 && (
                        <button
                          onClick={downloadZip}
                          disabled={zipping}
                          className="mt-2 flex items-center gap-1.5 bg-black text-white text-xs font-georgia-pro px-4 py-2 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-60"
                        >
                          {zipping ? 'Building…' : '⬇ Download Starter Kit'}
                        </button>
                      )}
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="bg-black text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-georgia-pro max-w-[85%] min-w-0 whitespace-pre-wrap overflow-hidden" style={{ overflowWrap: 'anywhere' }}>
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
                placeholder={rateLimited ? (walletAddress ? 'Daily limit reached — upgrade for unlimited builds' : 'Please sign in to continue') : 'Ask a follow-up…'}
                model={model}
                onModelChange={changeModel}
              />
              {rateLimited && walletAddress && (
                <p className="text-center text-xs font-georgia-pro text-gray-400 mt-2">
                  <button onClick={() => setShowPaywall(true)} className="underline hover:text-black transition-colors">Upgrade to Knead Monthly</button> for unlimited builds.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          setRateLimited(false);
          setTurnsLeft(FREE_TURNS_PER_DAY);
          setShowPaywall(false);
        }}
      />
    </div>
  );
}

// ─── Flip tile ────────────────────────────────────────────────────────────────

function FlipTile({ recipe, index, onOrder, selected, onSelect }: {
  recipe: BuildRecipe; index: number; onOrder: () => void; selected: boolean; onSelect: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative border-r border-b border-white/10 cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped((v) => !v)}
    >
      {/* Invisible spacer — sized to the larger of front/back so the tile always fits */}
      <div aria-hidden className="invisible p-6 flex flex-col gap-3">
        <p className="text-xs">{String(index + 1).padStart(2, '0')}</p>
        <p className="font-adonis text-2xl md:text-3xl leading-tight">{recipe.title}</p>
        <p className="font-georgia-pro text-sm leading-relaxed">{recipe.description}</p>
        <p className="text-xs">Build this →</p>
      </div>

      {/* Animated card — absolutely fills the spacer-sized container */}
      <div
        style={{
          transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'absolute', inset: 0,
        }}
      >
        {/* Front */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className="absolute inset-0 flex flex-col justify-between p-6"
        >
          <p className="font-adonis text-xs tracking-widest text-white/30">
            {String(index + 1).padStart(2, '0')}
          </p>
          <h3 className="font-adonis text-2xl md:text-3xl leading-tight text-white">
            {recipe.title}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.slice(0, 2).map((t) => (
              <span key={t} className="text-[10px] font-georgia-pro text-white/30 uppercase tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Back */}
        <div
          style={{
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="absolute inset-0 flex flex-col justify-between p-6 bg-white"
        >
          <h3 className="font-adonis text-lg leading-tight text-black">
            {recipe.title}
          </h3>
          <p className="font-georgia-pro text-sm leading-relaxed text-gray-600 flex-1 mt-3">
            {recipe.description}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`mt-4 text-xs font-georgia-pro underline underline-offset-2 transition-colors w-fit ${selected ? 'text-gray-400' : 'text-black hover:text-gray-500'}`}
          >
            {selected ? '✓ Added' : 'Build this →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Model picker ─────────────────────────────────────────────────────────────

function ModelPicker({ model, onChange, disabled }: {
  model: ModelId; onChange: (m: ModelId) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find((m) => m.id === model) ?? MODELS[0];

  return (
    // h-8 matches the send button's height so the label centers on the
    // input row's visual midline
    <div className="relative flex-shrink-0 self-end flex items-center h-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1 text-xs font-georgia-pro text-gray-400 hover:text-black transition-colors disabled:opacity-50"
        aria-label={`Model: ${current.full}`}
      >
        {current.label}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-3 z-20 w-44 bg-white border border-gray-200 rounded-xl shadow-sm py-1">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-georgia-pro text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
              >
                {m.full}
                {m.id === model && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Chat input ───────────────────────────────────────────────────────────────

function ChatInput({ inputRef, value, onChange, onSubmit, onKeyDown, loading, disabled, placeholder, model, onModelChange }: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  value: string; onChange: (v: string) => void; onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  loading: boolean; disabled: boolean; placeholder: string;
  model: ModelId; onModelChange: (m: ModelId) => void;
}) {
  return (
    <div className="flex items-end gap-3 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-gray-400 transition-colors bg-white">
      <ModelPicker model={model} onChange={onModelChange} disabled={disabled || loading} />
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
        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300)}
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
