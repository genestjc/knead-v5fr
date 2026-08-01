'use client';

/**
 * Agent Evaluation — pick a persona, pick who plays it, and let it walk the
 * live surface while you watch.
 *
 * The run is stepped one exchange at a time from the browser, so the
 * transcript builds in front of you and a stall never costs you the turns
 * already collected. When it finishes, the same run opens in the shared
 * detail view: grade it yourself, or hand it to Claude or GPT as the judge.
 */
import { useRef, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalProvider, EvalRun, EvalSurface, EvalTurn } from '@/lib/eval/types';
import { EVAL_SURFACES } from '@/lib/eval/types';
import { PERSONAS } from '@/lib/eval/personas';
import { SURFACE_BLOCKERS, CONVERSATIONAL_SURFACES } from '@/lib/eval/surfaces';
import { startAgentRun, stepAgentRun } from './api';
import { Banner, KNEAD_RED, SectionLabel, TranscriptView } from './shared';
import { RunDetail } from './RunDetail';

export function AgentTab({
  account,
  criteria,
  selectedRun,
  onSelectRun,
  onRefreshRuns,
  onRefreshSelected,
}: {
  account: Account | null;
  criteria: EvalCriterion[];
  selectedRun: EvalRun | null;
  onSelectRun: (id: string | null) => void;
  onRefreshRuns: () => void;
  onRefreshSelected: () => void;
}) {
  const [surface, setSurface] = useState<EvalSurface>('article-agent');
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const [provider, setProvider] = useState<EvalProvider>('claude');
  const [slug, setSlug] = useState('');
  const [surfaceModel, setSurfaceModel] = useState<'sonnet-5' | 'gpt-5'>('sonnet-5');
  const [maxTurns, setMaxTurns] = useState(PERSONAS[0].defaultTurns);

  const [running, setRunning] = useState(false);
  const [liveTurns, setLiveTurns] = useState<EvalTurn[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const persona = PERSONAS.find((p) => p.id === personaId)!;
  const blocker = SURFACE_BLOCKERS[surface];
  const needsSlug = surface === 'article-agent' || surface === 'audio-summaries';

  async function launch() {
    setError(null);
    setLiveTurns([]);
    setProgress(null);
    onSelectRun(null);

    if (needsSlug && !slug.trim()) {
      setError('Enter the slug of a published Knead story for this surface.');
      return;
    }

    setRunning(true);
    cancelled.current = false;

    try {
      const started = await startAgentRun(account, {
        surface,
        persona: personaId,
        provider,
        slug: slug.trim() || undefined,
        surfaceModel,
        maxTurns,
      });

      setLiveTurns(started.turns);
      onRefreshRuns();

      if (started.done || !CONVERSATIONAL_SURFACES.includes(surface)) {
        setProgress('Run complete.');
        onSelectRun(started.run.id);
        setRunning(false);
        return;
      }

      // Step until the persona is done, the surface errors, or we're stopped.
      for (let i = 0; i < maxTurns; i++) {
        if (cancelled.current) {
          setProgress('Stopped. Everything up to this point is saved.');
          break;
        }
        setProgress(`Turn ${i + 1} of ${maxTurns} — ${persona.name} is typing…`);

        const step = await stepAgentRun(account, started.run.id);
        setLiveTurns((prev) => [...prev, ...step.turns]);

        if (step.surfaceError) {
          setError(`The surface returned an error, so the run stopped: ${step.surfaceError}`);
        }
        if (step.done) {
          setProgress('Run complete.');
          break;
        }
      }

      onSelectRun(started.run.id);
      onRefreshRuns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      <section className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="font-adonis text-3xl">Walk the site as a persona</h2>
          <p className="font-georgia-pro text-sm text-gray-600 mt-1">
            A driver model plays the user and talks to the real endpoint — same request bodies, same
            rate limits, same in-app browser quirks. Nothing is mocked.
          </p>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Personas */}
          <div>
            <SectionLabel>User type</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {PERSONAS.map((p) => {
                const active = p.id === personaId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPersonaId(p.id);
                      setMaxTurns(p.defaultTurns);
                    }}
                    disabled={running}
                    className={`text-left p-3 border rounded-lg transition-colors disabled:opacity-50 ${
                      active ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-adonis text-[15px]">{p.name}</span>
                      {p.inAppBrowser && (
                        <span className="text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-pink-50 text-pink-700">
                          in-app
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-gray-500 font-georgia-pro line-clamp-3">
                      {p.blurb}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Surface + driver */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <SectionLabel>Surface</SectionLabel>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as EvalSurface)}
                disabled={running}
                className="w-full text-sm border border-gray-300 rounded-md p-2 bg-white outline-none focus:border-black"
              >
                {EVAL_SURFACES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-gray-500 font-georgia-pro">
                {EVAL_SURFACES.find((s) => s.id === surface)?.blurb}
              </p>
            </div>

            <div>
              <SectionLabel>Who plays the persona</SectionLabel>
              <div className="flex gap-2">
                {(['claude', 'openai'] as EvalProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    disabled={running}
                    className={`flex-1 py-2 text-sm font-medium border rounded-md transition-colors disabled:opacity-50 ${
                      provider === p
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {p === 'claude' ? 'Claude' : 'GPT'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-gray-500 font-georgia-pro">
                The judge is chosen separately, after the run.
              </p>
            </div>
          </div>

          {/* Surface-specific inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {needsSlug && (
              <div>
                <SectionLabel>Article slug</SectionLabel>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={running}
                  placeholder="the-story-slug"
                  className="w-full font-mono text-sm border border-gray-300 rounded-md p-2 outline-none focus:border-black"
                />
              </div>
            )}

            {surface === 'open-source' && (
              <div>
                <SectionLabel>Model the surface itself runs</SectionLabel>
                <select
                  value={surfaceModel}
                  onChange={(e) => setSurfaceModel(e.target.value as 'sonnet-5' | 'gpt-5')}
                  disabled={running}
                  className="w-full text-sm border border-gray-300 rounded-md p-2 bg-white outline-none focus:border-black"
                >
                  <option value="sonnet-5">Sonnet (the page default)</option>
                  <option value="gpt-5">GPT (the page&apos;s other option)</option>
                </select>
              </div>
            )}

            {CONVERSATIONAL_SURFACES.includes(surface) && (
              <div>
                <SectionLabel>Turns</SectionLabel>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  disabled={running}
                  className="w-full font-mono text-sm border border-gray-300 rounded-md p-2 outline-none focus:border-black"
                />
              </div>
            )}
          </div>

          {blocker && <Banner tone="info">{blocker}</Banner>}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={launch}
              disabled={running || Boolean(blocker)}
              className="px-5 py-2.5 text-sm font-medium text-white rounded-md disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: KNEAD_RED }}
            >
              {running ? 'Running…' : 'Start run'}
            </button>
            {running && (
              <button
                onClick={() => {
                  cancelled.current = true;
                }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-md hover:border-black"
              >
                Stop
              </button>
            )}
            {progress && (
              <span className="text-xs font-mono text-gray-500">{progress}</span>
            )}
          </div>
        </div>
      </section>

      {/* Live transcript while the run is in flight */}
      {running && liveTurns.length > 0 && (
        <section>
          <SectionLabel>Live · {liveTurns.length} turns</SectionLabel>
          <TranscriptView turns={liveTurns} />
        </section>
      )}

      {/* Finished run: grade it, or hand it to a judge */}
      {!running && selectedRun && (
        <RunDetail
          account={account}
          run={selectedRun}
          criteria={criteria}
          onRefresh={() => {
            onRefreshSelected();
            onRefreshRuns();
          }}
          onClose={() => onSelectRun(null)}
        />
      )}
    </div>
  );
}
