'use client';

/**
 * Live demo: the open-source build assistant, answering from this repository.
 *
 * Same endpoint the real page uses, with the same anonymous allowance (fifteen
 * turns a day per IP). Recipes are picked here rather than through the real
 * page's flip-tile menu — a visitor gets three slides of attention, not a
 * browsing session.
 *
 * The recipe ids are typed against RecipeId, so renaming one upstream breaks
 * this file at compile time instead of silently sending an id the route drops.
 */
import { useState } from 'react';
import type { RecipeId } from '@/lib/build-recipes';
import { ChatInput, ChatLog, LiveBadge, Starters, postChat, useDemoChat } from './deck-chat';

const DEMO_RECIPES: { id: RecipeId; label: string }[] = [
  { id: 'paywalled-blog', label: 'Paywalled Content' },
  { id: 'e2e-chat', label: 'Encrypted Chat' },
  { id: 'agentic-assistance', label: 'Agentic Assistance' },
  { id: 'membership-systems', label: 'Membership Systems' },
];

const STARTERS = [
  'How does the paywall actually work?',
  'Show me the file that routes between Claude and GPT.',
  'What would I need to build the encrypted chat?',
];

export function DemoBuildAssistant() {
  const [selected, setSelected] = useState<RecipeId[]>(['paywalled-blog', 'agentic-assistance']);

  const toggleRecipe = (id: RecipeId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const chat = useDemoChat((text, history) =>
    postChat('/api/open-source/chat', {
      message: text,
      history,
      recipeIds: selected,
      model: 'gpt-5',
    }),
  );

  return (
    <div className="border border-white/10 bg-black w-full">
      <div className="flex items-start justify-between gap-4 p-5 md:p-6 pb-4 border-b border-white/10">
        <div>
          <p className="font-adonis text-lg text-white leading-none mb-1.5">Build assistant</p>
          <LiveBadge>Live · /api/open-source/chat</LiveBadge>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-white/30">GPT-5.6 Terra</p>
          <p className="font-mono text-[10px] text-white/20">
            {chat.turnsLeft === null ? 'fallback: Sonnet 5' : `${chat.turnsLeft} free turns left`}
          </p>
        </div>
      </div>

      <div className="p-5 md:p-6 grid lg:grid-cols-[200px_1fr] gap-6">
        {/* min-w-0 on both tracks: chips and starter prompts are wide enough
            to blow the grid past a phone screen otherwise. */}
        <div className="min-w-0">
          <p className="font-georgia-pro text-[11px] uppercase tracking-[0.18em] text-white/30 mb-3">
            Loaded recipes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_RECIPES.map((r) => {
              const on = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRecipe(r.id)}
                  aria-pressed={on}
                  className={`font-georgia-pro text-[11px] rounded-full px-3 py-1.5 border transition-colors ${
                    on
                      ? 'bg-white text-black border-white'
                      : 'text-white/50 border-white/15 hover:text-white hover:border-white/40'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 font-georgia-pro text-[11px] text-white/30 leading-relaxed">
            Recipes load build context. The nine retrieval tools fetch the real files either way.
          </p>
        </div>

        <div className="flex flex-col min-w-0 min-h-[260px]">
          {(chat.messages.length > 0 || chat.loading) && (
            <ChatLog
              messages={chat.messages}
              loading={chat.loading}
              loadingNote="fetching source…"
              className="flex-1 h-[190px] md:h-[210px] mb-3"
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
            placeholder={chat.loading ? 'Reading the repo…' : 'Ask how any of it is built…'}
          />

          <a
            href="/open-source"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 font-georgia-pro text-[11px] text-white/40 hover:text-white transition-colors"
          >
            Open the full assistant, with all twelve recipes and the starter-kit export ↗
          </a>
        </div>
      </div>
    </div>
  );
}
