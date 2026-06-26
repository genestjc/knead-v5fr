'use client';

import { useState, useRef, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { RECIPES, FREE_TURNS_PER_DAY, type RecipeId, type BuildRecipe } from '@/lib/build-recipes';

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/open-source/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        onUnlock();
      } else {
        setError('Wrong password.');
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-2xl font-bold text-black mb-1">Knead Open Source</p>
        <p className="text-gray-400 text-sm mb-8">Early access — enter the password to continue.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className="border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !pw}
            className="bg-black text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {loading ? 'Checking…' : 'Enter →'}
          </button>
        </form>
      </div>
    </div>
  );
}

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
  const [unlocked, setUnlocked] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const account = useActiveAccount();

  // Check cookie on mount
  useEffect(() => {
    fetch('/api/open-source/auth', { method: 'GET' })
      .then((r) => { if (r.ok) setUnlocked(true); })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) return null;
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

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
          walletAddress, // server verifies premium status — never send isPremium from client
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-gray-400 hover:text-black transition-colors">← Knead</a>
          <span className="text-gray-200">|</span>
          <span className="font-semibold text-black">Open Source</span>
        </div>
        <div className="flex items-center gap-4">
          {turnsLeft < FREE_TURNS_PER_DAY && !rateLimited && (
            <span className="text-xs text-gray-400">
              {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left today
            </span>
          )}
          {zipProposal && (
            <button
              onClick={downloadZip}
              disabled={zipping}
              className="flex items-center gap-2 bg-black text-white text-sm px-4 py-2 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {zipping ? '⏳ Building…' : '⬇ Download Starter'}
            </button>
          )}
        </div>
      </header>

      {/* Selected recipe chips */}
      {selectedRecipes.length > 0 && (
        <div className="px-6 py-2 flex flex-wrap gap-2 border-b border-gray-50">
          {selectedRecipes.map((id) => {
            const r = RECIPES.find((x) => x.id === id)!;
            return (
              <span key={id} className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-3 py-1">
                {r.emoji} {r.title}
                <button className="ml-1 text-gray-400 hover:text-black" onClick={() => toggleRecipe(id)}>×</button>
              </span>
            );
          })}
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4">
        {showMenu ? (
          <div className="flex-1 py-12">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-black mb-3">
                Ask Demeter what you&apos;d like to build.
              </h1>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                Want a paywalled Sanity blog? You&apos;ve got it. Want a streaming site with Apple Pay
                too? No problem. Anything from our stack, you can have.
              </p>
              <p className="text-gray-400 text-sm mt-3">
                Can&apos;t decide?{' '}
                <button
                  className="underline hover:text-black transition-colors"
                  onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Check out the menu ↓
                </button>
              </p>
            </div>

            <div className="mb-12">
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

            <div id="menu" className="scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">Today&apos;s Menu</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RECIPES.map((recipe) => (
                  <MenuTile
                    key={recipe.id}
                    recipe={recipe}
                    selected={selectedRecipes.includes(recipe.id)}
                    onToggle={() => toggleRecipe(recipe.id)}
                    onOrder={() => startWithRecipe(recipe)}
                  />
                ))}
              </div>

              <p className="text-center text-xs text-gray-300 mt-8">
                Knead is open-source. Everything here comes from our repository.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col py-6">
            <div className="flex-1 space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex flex-col gap-1 max-w-[85%]">
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
                        <MessageContent content={msg.content} />
                      </div>
                      <button
                        onClick={() => speakMessage(msg.content, i)}
                        className="text-left text-xs text-gray-300 hover:text-gray-500 transition-colors pl-1"
                      >
                        {speakingMsgIdx === i ? '⏸ stop' : '🔊 listen'}
                      </button>
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="bg-black text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[85%] whitespace-pre-wrap">
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

            {zipProposal && (
              <div className="mb-3 bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-black">Starter kit ready</p>
                  <p className="text-xs text-gray-400">
                    {zipProposal.files.length} file{zipProposal.files.length !== 1 ? 's' : ''} · README included
                  </p>
                </div>
                <button
                  onClick={downloadZip}
                  disabled={zipping}
                  className="bg-black text-white text-sm px-4 py-2 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {zipping ? 'Building…' : '⬇ Download'}
                </button>
              </div>
            )}

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
              <p className="text-center text-xs text-gray-400 mt-2">
                <a href="/join" className="underline hover:text-black">Upgrade to Knead Monthly</a>{' '}
                for unlimited builds.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MenuTile({ recipe, selected, onToggle, onOrder }: {
  recipe: BuildRecipe; selected: boolean; onToggle: () => void; onOrder: () => void;
}) {
  return (
    <div
      className={`relative border rounded-xl p-4 cursor-pointer transition-all ${
        selected ? 'border-black bg-black text-white' : 'border-gray-100 bg-white hover:border-gray-300'
      }`}
      onClick={onToggle}
    >
      <p className="text-xl mb-1">{recipe.emoji}</p>
      <p className={`font-semibold text-sm ${selected ? 'text-white' : 'text-black'}`}>{recipe.title}</p>
      <p className={`text-xs mt-1 leading-relaxed ${selected ? 'text-gray-300' : 'text-gray-400'}`}>{recipe.description}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {recipe.tags.map((t) => (
          <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full ${selected ? 'bg-white/20 text-gray-200' : 'bg-gray-100 text-gray-500'}`}>
            {t}
          </span>
        ))}
      </div>
      <button
        className={`absolute bottom-3 right-3 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
          selected ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800'
        }`}
        onClick={(e) => { e.stopPropagation(); onOrder(); }}
      >
        Build this →
      </button>
    </div>
  );
}

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
        className="flex-1 resize-none outline-none text-sm text-black placeholder-gray-300 bg-transparent leading-relaxed disabled:opacity-50"
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
