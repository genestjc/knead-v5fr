'use client';

/**
 * Sentiment — what the replies say, and what to do about it.
 *
 * The sample size sits at the top, before the findings, and a thin sample is
 * called thin in plain language. Eleven replies read as a mood in every social
 * dashboard ever built, and they are eleven people.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { AgentProvider } from '@/lib/social/types';
import type { SentimentTheme } from '@/lib/social/agents/sentiment';
import { runSentiment, type SentimentResult } from './api';
import {
  Banner,
  CaveatPanel,
  Empty,
  ParseErrorNotice,
  PriorityPill,
  ProviderPicker,
  RunButton,
  SectionLabel,
  Spinner,
  WindowPicker,
} from './shared';

/** Below this, the console refuses to present the sample as a reading. */
const THIN_SAMPLE = 25;

export function SentimentTab({ account }: { account: Account | null }) {
  const [windowDays, setWindowDays] = useState(14);
  const [provider, setProvider] = useState<AgentProvider>('claude');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SentimentResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await runSentiment(account, {
          windowDays,
          provider,
          subject: subject.trim() || undefined,
        }),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const report = result?.report ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl">Sentiment</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          Pulls the reply threads under our posts and reads them. Returns themes, risks worth
          acting on before tomorrow, and the people worth answering — each carrying the reply it
          came from.
        </p>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="flex-1 min-w-[260px]">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
            Narrow to a subject (optional)
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={busy}
            placeholder="e.g. Richard Nadler — leave blank to read everything"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
          />
        </label>
        <WindowPicker value={windowDays} onChange={setWindowDays} disabled={busy} />
        <ProviderPicker value={provider} onChange={setProvider} disabled={busy} />
        <RunButton onClick={run} busy={busy}>
          Read the replies
        </RunButton>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && <Spinner label="Pulling reply threads, then reading them…" />}

      {!busy && !result && <Empty>No sentiment run yet.</Empty>}

      {result && !busy && (
        <>
          <CaveatPanel caveats={result.caveats} />

          {result.sampleSize === 0 ? (
            <Banner tone="warn">
              <strong className="font-medium">No reply text was available to read.</strong> That is
              a collection outcome, not a finding — it means the replies could not be fetched, not
              that the posts drew none. The caveats above say what blocked each platform.
            </Banner>
          ) : (
            <div
              className={`border rounded-md px-4 py-3 ${
                result.sampleSize < THIN_SAMPLE
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-2xl text-gray-900">{result.sampleSize}</span>
                <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                  replies read
                </span>
                {report?.positiveShare !== null && report?.positiveShare !== undefined && (
                  <span className="font-mono text-sm text-gray-600">
                    {Math.round(report.positiveShare)}% positive
                  </span>
                )}
              </div>
              {result.sampleSize < THIN_SAMPLE && (
                <p className="font-georgia-pro text-[13px] text-amber-900 mt-1">
                  That is {result.sampleSize} {result.sampleSize === 1 ? 'person' : 'people'}, not a
                  readership. Read what follows as individual responses.
                </p>
              )}
              {report?.confidence && (
                <p className="font-georgia-pro text-[13px] text-gray-600 mt-1">{report.confidence}</p>
              )}
            </div>
          )}

          {report && (
            <>
              <ParseErrorNotice error={report.parseError} />

              {report.verdict && (
                <div className="border-l-2 border-black pl-4 py-1">
                  <SectionLabel>Verdict</SectionLabel>
                  <p className="font-georgia-pro text-[16px] text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {report.verdict}
                  </p>
                </div>
              )}

              {report.risks.length > 0 && (
                <div>
                  <SectionLabel>Act on these</SectionLabel>
                  <div className="space-y-3">
                    {report.risks.map((risk, i) => (
                      <div key={i} className="border border-gray-200 rounded-md p-4">
                        <div className="flex items-start gap-3">
                          <PriorityPill priority={risk.severity} />
                          <div className="flex-1">
                            <p className="font-georgia-pro text-[15px] text-gray-900">{risk.issue}</p>
                            {risk.evidence && (
                              <p className="font-georgia-pro text-[14px] text-gray-500 italic mt-2 border-l-2 border-gray-200 pl-3">
                                &ldquo;{risk.evidence}&rdquo;
                              </p>
                            )}
                            {risk.suggestedResponse && (
                              <p className="font-georgia-pro text-[14px] text-gray-700 mt-2">
                                → {risk.suggestedResponse}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.themes.length > 0 && (
                <div>
                  <SectionLabel>Themes</SectionLabel>
                  <div className="space-y-3">
                    {report.themes.map((theme, i) => (
                      <ThemeCard key={i} theme={theme} />
                    ))}
                  </div>
                </div>
              )}

              {report.voices.length > 0 && (
                <div>
                  <SectionLabel>Worth answering</SectionLabel>
                  <ul className="space-y-2">
                    {report.voices.map((voice, i) => (
                      <li key={i} className="font-georgia-pro text-[15px] text-gray-800">
                        <span className="font-mono text-[13px] text-gray-900">@{voice.handle}</span>{' '}
                        <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400">
                          {voice.platform}
                        </span>{' '}
                        — {voice.why}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] font-mono text-gray-400">judged by {report.model}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

const VALENCE_TONES: Record<SentimentTheme['valence'], string> = {
  positive: 'text-emerald-700',
  negative: 'text-red-700',
  mixed: 'text-amber-700',
  neutral: 'text-gray-500',
};

function ThemeCard({ theme }: { theme: SentimentTheme }) {
  return (
    <div className="border border-gray-200 rounded-md p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] uppercase tracking-[0.12em] font-mono text-gray-400">
          {theme.weight}
        </span>
        <span className={`text-[10px] uppercase tracking-[0.12em] font-mono ${VALENCE_TONES[theme.valence]}`}>
          {theme.valence}
        </span>
      </div>
      <p className="font-georgia-pro text-[15px] text-gray-900">{theme.theme}</p>
      {theme.evidence.map((quote, i) => (
        <p key={i} className="font-georgia-pro text-[14px] text-gray-500 mt-2 border-l-2 border-gray-200 pl-3">
          &ldquo;{quote.quote}&rdquo;
          <span className="font-mono text-[11px] text-gray-400 block mt-0.5">
            — @{quote.handle} · {quote.platform}
          </span>
        </p>
      ))}
    </div>
  );
}
