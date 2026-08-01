'use client';

/**
 * Shared pieces for the Probatio Parsley console — Knead's editorial identity
 * (Adonis headings, Georgia Pro body, black on white, one red accent) applied
 * to a dense evaluation UI. Logs and verdicts stay monospace so numbers line
 * up; everything a person reads stays in the magazine's serif.
 */
import { useState } from 'react';
import type { EvalTurn, Verdict } from '@/lib/eval/types';

export const KNEAD_RED = '#FF6B6B';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium mb-2">
      {children}
    </div>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const styles: Record<Verdict, string> = {
    pass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    fail: 'bg-red-50 text-red-800 border-red-200',
    na: 'bg-gray-50 text-gray-500 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono ${styles[verdict]}`}
    >
      {verdict === 'na' ? 'n/a' : verdict}
    </span>
  );
}

export function VerdictToggle({
  value,
  onChange,
  disabled,
}: {
  value: Verdict | null;
  onChange: (v: Verdict) => void;
  disabled?: boolean;
}) {
  const options: { id: Verdict; label: string; on: string }[] = [
    { id: 'pass', label: 'Pass', on: 'bg-emerald-600 text-white border-emerald-600' },
    { id: 'fail', label: 'Fail', on: 'bg-red-600 text-white border-red-600' },
    { id: 'na', label: 'N/A', on: 'bg-gray-700 text-white border-gray-700' },
  ];
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-gray-300 divide-x divide-gray-300">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            value === o.id ? o.on : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Banner({
  tone = 'error',
  children,
  onDismiss,
}: {
  tone?: 'error' | 'info' | 'success';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const tones = {
    error: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-gray-50 border-gray-200 text-gray-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`border rounded-md px-4 py-3 text-sm font-georgia-pro flex gap-3 ${tones[tone]}`}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-xs opacity-60 hover:opacity-100 shrink-0">
          Dismiss
        </button>
      )}
    </div>
  );
}

export function ScoreBar({ counts }: { counts: { pass: number; fail: number; na: number } }) {
  const total = counts.pass + counts.fail + counts.na;
  if (total === 0) return <span className="text-xs text-gray-400 font-mono">ungraded</span>;
  const pct = Math.round((counts.pass / Math.max(counts.pass + counts.fail, 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 h-full" style={{ width: `${(counts.pass / total) * 100}%` }} />
        <div className="bg-red-500 h-full" style={{ width: `${(counts.fail / total) * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600">
        {counts.pass}/{counts.pass + counts.fail} ({pct}%)
      </span>
    </div>
  );
}

/**
 * The transcript: every turn, in order, with its behavior log one click away.
 * The log is the difference between "the agent was wrong" and "the agent was
 * wrong because the cache missed and it re-narrated a stale body" — so it sits
 * on the turn, not in a separate console.
 */
export function TranscriptView({ turns }: { turns: EvalTurn[] }) {
  if (turns.length === 0) {
    return (
      <p className="text-sm text-gray-500 font-georgia-pro italic py-6 text-center">
        No turns recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {turns.map((turn) => (
        <TurnRow key={turn.id ?? turn.turnIndex} turn={turn} />
      ))}
    </div>
  );
}

function TurnRow({ turn }: { turn: EvalTurn }) {
  const [showLog, setShowLog] = useState(false);
  const hasLog = turn.metadata && Object.keys(turn.metadata).length > 0;

  if (turn.role === 'event') {
    return (
      <div className="border-l-2 border-gray-300 pl-3 py-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-mono">
            probe
          </span>
          <span className="text-xs font-mono text-gray-600">{turn.content}</span>
          {hasLog && <LogToggle open={showLog} onClick={() => setShowLog((v) => !v)} />}
        </div>
        {showLog && <LogBlock metadata={turn.metadata} />}
      </div>
    );
  }

  const isUser = turn.role === 'user';

  return (
    <div
      className={`border rounded-lg p-4 ${
        isUser ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-[0.14em] font-medium"
          style={{ color: isUser ? '#6b7280' : KNEAD_RED }}
        >
          {isUser ? 'Persona' : 'Knead agent'}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">#{turn.turnIndex}</span>
        {turn.latencyMs != null && (
          <span className="text-[10px] text-gray-400 font-mono">{turn.latencyMs}ms</span>
        )}
        {typeof turn.metadata?.wordCount === 'number' && (
          <span
            className={`text-[10px] font-mono ${
              turn.metadata.wordCount > 200 && !isUser ? 'text-red-600 font-bold' : 'text-gray-400'
            }`}
          >
            {turn.metadata.wordCount}w
          </span>
        )}
        {turn.metadata?.cache && (
          <span
            className={`text-[10px] font-mono px-1.5 rounded ${
              turn.metadata.cache === 'hit'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            cache:{turn.metadata.cache}
          </span>
        )}
        {turn.metadata?.hasShareBlock && (
          <span className="text-[10px] font-mono px-1.5 rounded bg-blue-50 text-blue-700">
            [SHARE]
          </span>
        )}
        {turn.metadata?.zipProposed && (
          <span className="text-[10px] font-mono px-1.5 rounded bg-purple-50 text-purple-700">
            zip:{turn.metadata.zipFileCount}
          </span>
        )}
        {turn.metadata?.userAgent?.includes('Instagram') && (
          <span className="text-[10px] font-mono px-1.5 rounded bg-pink-50 text-pink-700">
            in-app
          </span>
        )}
        {turn.metadata?.error && (
          <span className="text-[10px] font-mono px-1.5 rounded bg-red-50 text-red-700">error</span>
        )}
        <div className="ml-auto">
          {hasLog && <LogToggle open={showLog} onClick={() => setShowLog((v) => !v)} />}
        </div>
      </div>

      <p className="font-georgia-pro text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap">
        {turn.content}
      </p>

      {showLog && <LogBlock metadata={turn.metadata} />}
    </div>
  );
}

function LogToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900 transition-colors"
    >
      {open ? 'Hide log' : 'Log'}
    </button>
  );
}

function LogBlock({ metadata }: { metadata: Record<string, any> }) {
  return (
    <pre className="mt-3 text-[11px] font-mono bg-gray-900 text-gray-100 rounded-md p-3 overflow-x-auto leading-relaxed">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}
