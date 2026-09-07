'use client';

/**
 * Draft Check — grade a story before it publishes.
 *
 * The other AEO surfaces measure pages that are already live, which is the
 * wrong moment to learn something is wrong. This runs against a Sanity draft,
 * where a fix costs a field rather than an edit and a re-crawl.
 *
 * The proposals are the point. A list of missing fields gets closed; a written
 * excerpt and five extracted facts get accepted or edited. Everything proposed
 * is copyable straight into Studio.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { CheckStatus } from '@/lib/eval/aeo-signals';
import { checkDraft, type DraftReport } from './api';
import type { DraftAdvice } from '@/lib/eval/draft-advisor';
import type { EvalProvider } from '@/lib/eval/types';
import { Banner, KNEAD_RED, SectionLabel } from './shared';

export function DraftCheckTab({ account }: { account: Account | null }) {
  const [id, setId] = useState('');
  const [provider, setProvider] = useState<EvalProvider>('claude');
  const [advise, setAdvise] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DraftReport | null>(null);
  const [advice, setAdvice] = useState<DraftAdvice | null>(null);
  const [isDraft, setIsDraft] = useState(false);

  async function run() {
    setError(null);
    setReport(null);
    setAdvice(null);
    setRunning(true);
    try {
      const out = await checkDraft(account, { id: id.trim(), provider, advise });
      setReport(out.report);
      setAdvice(out.advice);
      setIsDraft(out.isDraft);
      if (advise && !out.advice) {
        setError('The checks ran, but the advisor pass failed — scores below are still valid.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Check a draft</SectionLabel>
        <p className="mt-2 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
          Paste a document id or a slug. Grades the story on what decides citations — whether it
          names its subject where an engine looks, carries quotes only we have, and pins dates — then
          drafts the fields it is missing.
        </p>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[280px]">
          <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
            Document id or slug
          </label>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="can-ai-make-an-artist-better-an-interview-with-richard-nadler"
            className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-[13px] focus:outline-none focus:border-black"
          />
        </div>
        <button
          onClick={run}
          disabled={running || !id.trim()}
          className="px-5 py-2.5 rounded text-white text-sm font-medium disabled:opacity-40"
          style={{ backgroundColor: KNEAD_RED }}
        >
          {running ? 'Checking…' : 'Check draft'}
        </button>
        <label className="flex items-center gap-2 text-[13px] text-gray-700 pb-2.5">
          <input type="checkbox" checked={advise} onChange={(e) => setAdvise(e.target.checked)} disabled={running} />
          Draft the fixes
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as EvalProvider)}
          disabled={running || !advise}
          className="text-[13px] border border-gray-300 rounded px-2 py-1.5 bg-white disabled:opacity-40 mb-2"
        >
          <option value="claude">Claude</option>
          <option value="openai">GPT</option>
        </select>
      </div>

      {running && (
        <div className="py-10 text-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-black mx-auto mb-3" />
          <p className="font-georgia-pro text-gray-500">
            {advise ? 'Checking the draft, then reading it…' : 'Checking the draft…'}
          </p>
        </div>
      )}

      {report && (
        <div>
          <div className="flex items-baseline gap-3 flex-wrap mb-4">
            <h3 className="font-adonis text-2xl">{report.title}</h3>
            <span className="font-mono text-sm tabular-nums">{report.score}/100</span>
            <span
              className={`text-[11px] uppercase tracking-[0.14em] px-2 py-0.5 rounded ${
                isDraft ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isDraft ? 'unpublished draft' : 'published'}
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mb-5">
            {report.wordCount} words · {report.quotedPassages} quoted · {report.specificityMarkers} specificity
            markers · subject: {report.primarySubject ?? 'none tagged'}
          </p>

          <ul className="space-y-2">
            {report.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <StatusDot status={c.status} />
                <div className="min-w-0">
                  <div className="text-[14px] text-gray-900">{c.label}</div>
                  <div className="text-[13px] text-gray-500">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice && <AdvicePanel advice={advice} />}
    </div>
  );
}

function AdvicePanel({ advice }: { advice: DraftAdvice }) {
  return (
    <div className="space-y-6 pt-6 border-t border-gray-200">
      <div>
        <SectionLabel>Proposed</SectionLabel>
        <p className="mt-1 text-[12px] text-gray-500">
          Drafted by {advice.model} from this piece&rsquo;s own text. Nothing here is invented — if the
          body does not support a fact, it is not proposed.
        </p>
        {advice.verdict && (
          <p className="mt-3 font-georgia-pro text-[16px] leading-relaxed text-gray-800 max-w-3xl">
            {advice.verdict}
          </p>
        )}
      </div>

      {advice.proposedExcerpt && (
        <Proposal label="Excerpt">
          <p className="font-georgia-pro text-[15px] text-gray-800">{advice.proposedExcerpt}</p>
          <CopyHint value={advice.proposedExcerpt} />
        </Proposal>
      )}

      {advice.proposedSubjects.length > 0 && (
        <Proposal label="Subjects">
          <ul className="space-y-1">
            {advice.proposedSubjects.map((s, i) => (
              <li key={i} className="text-[14px] text-gray-800">
                {s.name} <span className="text-gray-400">· {s.type}</span>
              </li>
            ))}
          </ul>
        </Proposal>
      )}

      {advice.proposedKeyFacts.length > 0 && (
        <Proposal label="Key facts">
          <ul className="space-y-2">
            {advice.proposedKeyFacts.map((f, i) => (
              <li key={i} className="text-[14px] text-gray-800">
                {f.when && <span className="text-gray-400 font-mono text-[12px] mr-2">{f.when}</span>}
                {f.fact}
              </li>
            ))}
          </ul>
        </Proposal>
      )}

      {advice.editorialNotes.length > 0 && (
        <Proposal label="For the writer">
          <ul className="space-y-2 list-disc pl-5">
            {advice.editorialNotes.map((n, i) => (
              <li key={i} className="text-[14px] text-gray-800">
                {n}
              </li>
            ))}
          </ul>
        </Proposal>
      )}
    </div>
  );
}

function Proposal({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">{label}</h4>
      <div className="border-l-2 border-gray-300 pl-4">{children}</div>
    </div>
  );
}

/** Copy is a convenience; the value is visible either way if it fails. */
function CopyHint({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="mt-2 text-[12px] text-gray-500 underline hover:text-black"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StatusDot({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { bg: string; ch: string }> = {
    pass: { bg: '#15803D', ch: '✓' },
    warn: { bg: '#B45309', ch: '!' },
    fail: { bg: '#B91C1C', ch: '✕' },
    na: { bg: '#D4D4D4', ch: '–' },
  };
  const s = map[status];
  return (
    <span
      className="mt-1 inline-flex shrink-0 items-center justify-center w-5 h-5 rounded-full text-white text-[11px] leading-none"
      style={{ backgroundColor: s.bg }}
    >
      {s.ch}
    </span>
  );
}
