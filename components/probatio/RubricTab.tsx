'use client';

/**
 * Human Evaluation / Rubric Setting — the source of truth.
 *
 * Everything the Agent Evaluation tab scores against is defined here: the
 * edge cases per surface, editable in place. Below the rubric sit the saved
 * runs, where a human can record a session (or paste a real transcript),
 * read the behavior logs, and grade it by hand.
 */
import { useMemo, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalRun, EvalSurface } from '@/lib/eval/types';
import { EVAL_SURFACES } from '@/lib/eval/types';
import { PERSONAS } from '@/lib/eval/personas';
import { createCriterion, createHumanRun, deleteCriterion, deleteRun, updateCriterion } from './api';
import { Banner, ScoreBar, SectionLabel } from './shared';
import { RunDetail } from './RunDetail';

export function RubricTab({
  account,
  criteria,
  runs,
  surface,
  onSurfaceChange,
  selectedRun,
  onSelectRun,
  onRefreshCriteria,
  onRefreshRuns,
  onRefreshSelected,
}: {
  account: Account | null;
  criteria: EvalCriterion[];
  runs: EvalRun[];
  surface: EvalSurface;
  onSurfaceChange: (s: EvalSurface) => void;
  selectedRun: EvalRun | null;
  onSelectRun: (id: string | null) => void;
  onRefreshCriteria: () => void;
  onRefreshRuns: () => void;
  onRefreshSelected: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const surfaceCriteria = useMemo(
    () =>
      criteria
        .filter((c) => c.surface === surface && (showArchived || c.isActive))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [criteria, surface, showArchived],
  );

  const surfaceRuns = useMemo(() => runs.filter((r) => r.surface === surface), [runs, surface]);

  return (
    <div className="space-y-10">
      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {/* Surface selector */}
      <div>
        <SectionLabel>Product under test</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {EVAL_SURFACES.map((s) => {
            const count = criteria.filter((c) => c.surface === s.id && c.isActive).length;
            const active = s.id === surface;
            return (
              <button
                key={s.id}
                onClick={() => onSurfaceChange(s.id)}
                className={`text-left p-3 border rounded-lg transition-colors ${
                  active ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="font-adonis text-[15px] leading-tight">{s.label}</div>
                <div
                  className={`mt-1 text-[11px] font-mono ${active ? 'text-gray-300' : 'text-gray-400'}`}
                >
                  {count} edge case{count === 1 ? '' : 's'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rubric editor */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h2 className="font-adonis text-3xl">Rubric</h2>
            <p className="font-georgia-pro text-sm text-gray-600 mt-1">
              Pass/fail edge cases for {EVAL_SURFACES.find((s) => s.id === surface)?.label}. These
              are what both human graders and the LLM judge score against.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-black"
            />
            Show archived
          </label>
        </div>

        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
          {surfaceCriteria.map((criterion, index) => (
            <CriterionRow
              key={criterion.id}
              account={account}
              criterion={criterion}
              index={index + 1}
              onChanged={onRefreshCriteria}
              onError={setError}
            />
          ))}
          {surfaceCriteria.length === 0 && (
            <p className="p-6 text-sm text-gray-500 font-georgia-pro italic text-center">
              No edge cases for this surface yet.
            </p>
          )}
        </div>

        <AddCriterion
          account={account}
          surface={surface}
          onAdded={onRefreshCriteria}
          onError={setError}
        />
      </section>

      {/* Saved runs */}
      <section>
        <h2 className="font-adonis text-3xl mb-1">Saved runs</h2>
        <p className="font-georgia-pro text-sm text-gray-600 mb-4">
          Every test run keeps its full conversation and behavior log, so a failure can be traced
          back to the exact input that caused it.
        </p>

        <RecordRun account={account} surface={surface} onSaved={onRefreshRuns} onError={setError} />

        <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-200">
          {surfaceRuns.map((run) => (
            <button
              key={run.id}
              onClick={() => onSelectRun(selectedRun?.id === run.id ? null : run.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-4 ${
                selectedRun?.id === run.id ? 'bg-gray-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-georgia-pro text-[15px] text-gray-900 truncate">
                  {run.title}
                </div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-gray-400 mt-0.5">
                  {run.mode} · {new Date(run.createdAt).toLocaleDateString()} ·{' '}
                  <span className={run.status === 'failed' ? 'text-red-600' : ''}>{run.status}</span>
                </div>
              </div>
              {run.counts && <ScoreBar counts={run.counts} />}
            </button>
          ))}
          {surfaceRuns.length === 0 && (
            <p className="p-6 text-sm text-gray-500 font-georgia-pro italic text-center">
              No runs saved for this surface yet.
            </p>
          )}
        </div>
      </section>

      {selectedRun && (
        <section>
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
          <div className="mt-3 text-right">
            <button
              onClick={async () => {
                if (!confirm(`Delete "${selectedRun.title}"? Its transcript and verdicts go too.`)) {
                  return;
                }
                try {
                  await deleteRun(account, selectedRun.id);
                  onSelectRun(null);
                  onRefreshRuns();
                } catch (err: any) {
                  setError(err.message);
                }
              }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              Delete this run
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function CriterionRow({
  account,
  criterion,
  index,
  onChanged,
  onError,
}: {
  account: Account | null;
  criterion: EvalCriterion;
  index: number;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(criterion.prompt);
  const [guidance, setGuidance] = useState(criterion.guidance ?? '');
  const [expected, setExpected] = useState(criterion.expectedVerdict);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!prompt.trim()) return onError('The criterion text is required.');
    setBusy(true);
    try {
      await updateCriterion(account, criterion.id, {
        prompt: prompt.trim(),
        guidance: guidance.trim() || null,
        expectedVerdict: expected,
      });
      setEditing(false);
      onChanged();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      await deleteCriterion(account, criterion.id);
      onChanged();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      await updateCriterion(account, criterion.id, { isActive: true });
      onChanged();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="p-4 bg-gray-50">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full font-georgia-pro text-[15px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
          placeholder="The pass/fail question"
        />
        <textarea
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          rows={3}
          className="mt-2 w-full font-georgia-pro text-[13px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
          placeholder="How to grade it: what counts as a pass, and the probe to send."
        />
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={expected === 'fail'}
              onChange={(e) => setExpected(e.target.checked ? 'fail' : 'pass')}
              className="accent-black"
            />
            Inverted — doing this is the failure
          </label>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:border-black"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 group ${criterion.isActive ? '' : 'bg-gray-50 opacity-60'}`}>
      <div className="flex gap-4">
        <span className="text-xs font-mono text-gray-400 pt-0.5 w-6 shrink-0">{index}</span>
        <div className="flex-1 min-w-0">
          <p className="font-georgia-pro text-[15px] text-gray-900 leading-snug">
            {criterion.prompt}
            {criterion.expectedVerdict === 'fail' && (
              <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-amber-700">
                inverted
              </span>
            )}
            {!criterion.isActive && (
              <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-gray-500">
                archived
              </span>
            )}
          </p>
          {criterion.guidance && (
            <p className="mt-1 text-[13px] text-gray-500 font-georgia-pro leading-snug">
              {criterion.guidance}
            </p>
          )}
        </div>
        <div className="flex gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] uppercase tracking-[0.1em] text-gray-400 hover:text-black"
          >
            Edit
          </button>
          {criterion.isActive ? (
            <button
              onClick={archive}
              disabled={busy}
              className="text-[11px] uppercase tracking-[0.1em] text-gray-400 hover:text-red-600"
            >
              Delete
            </button>
          ) : (
            <button
              onClick={restore}
              disabled={busy}
              className="text-[11px] uppercase tracking-[0.1em] text-gray-400 hover:text-black"
            >
              Restore
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddCriterion({
  account,
  surface,
  onAdded,
  onError,
}: {
  account: Account | null;
  surface: EvalSurface;
  onAdded: () => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [guidance, setGuidance] = useState('');
  const [expected, setExpected] = useState<'pass' | 'fail'>('pass');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs uppercase tracking-[0.12em] text-gray-500 hover:text-black transition-colors"
      >
        + Add an edge case
      </button>
    );
  }

  return (
    <div className="mt-3 border border-gray-300 rounded-lg p-4">
      <SectionLabel>New edge case</SectionLabel>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Did the agent…?"
        className="w-full font-georgia-pro text-[15px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
      />
      <textarea
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        rows={3}
        placeholder="How to grade it: what counts as a pass, and the probe to send."
        className="mt-2 w-full font-georgia-pro text-[13px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
      />
      <div className="mt-3 flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={expected === 'fail'}
            onChange={(e) => setExpected(e.target.checked ? 'fail' : 'pass')}
            className="accent-black"
          />
          Inverted — doing this is the failure
        </label>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              setOpen(false);
              setPrompt('');
              setGuidance('');
            }}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:border-black"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!prompt.trim()) return onError('The criterion text is required.');
              setBusy(true);
              try {
                await createCriterion(account, {
                  surface,
                  prompt: prompt.trim(),
                  guidance: guidance.trim() || undefined,
                  expectedVerdict: expected,
                });
                setPrompt('');
                setGuidance('');
                setExpected('pass');
                setOpen(false);
                onAdded();
              } catch (err: any) {
                onError(err.message);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="px-3 py-1.5 text-xs bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-40"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordRun({
  account,
  surface,
  onSaved,
  onError,
}: {
  account: Account | null;
  surface: EvalSurface;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [persona, setPersona] = useState('');
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs uppercase tracking-[0.12em] text-gray-500 hover:text-black transition-colors"
      >
        + Record a run by hand
      </button>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <SectionLabel>Record a run</SectionLabel>
      <p className="font-georgia-pro text-[13px] text-gray-500 mb-3">
        For sessions you ran yourself, or for surfaces that can&apos;t be driven automatically.
        Paste the conversation with <span className="font-mono">User:</span> and{' '}
        <span className="font-mono">Agent:</span> labels — multi-paragraph replies are kept whole.
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Run title"
        className="w-full font-georgia-pro text-[15px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
      />

      <select
        value={persona}
        onChange={(e) => setPersona(e.target.value)}
        className="mt-2 w-full text-sm border border-gray-300 rounded-md p-2 outline-none focus:border-black bg-white"
      >
        <option value="">No persona (free-form session)</option>
        {PERSONAS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={8}
        placeholder={'User: what is this story about?\nAgent: It\'s a profile of…'}
        className="mt-2 w-full font-mono text-[13px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className="mt-2 w-full font-georgia-pro text-[13px] border border-gray-300 rounded-md p-2 outline-none focus:border-black"
      />

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:border-black"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!title.trim()) return onError('Give the run a title.');
            setBusy(true);
            try {
              const { turnsSaved } = await createHumanRun(account, {
                surface,
                title: title.trim(),
                persona: persona || null,
                notes: notes.trim() || undefined,
                transcript,
              });
              if (transcript.trim() && turnsSaved === 0) {
                onError(
                  'Saved the run, but no turns were parsed — start each message with "User:" or "Agent:".',
                );
              }
              setTitle('');
              setNotes('');
              setTranscript('');
              setPersona('');
              setOpen(false);
              onSaved();
            } catch (err: any) {
              onError(err.message);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="px-3 py-1.5 text-xs bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save run'}
        </button>
      </div>
    </div>
  );
}
