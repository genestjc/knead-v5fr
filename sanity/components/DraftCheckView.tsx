/**
 * "AEO check" — a document view inside Sanity Studio.
 *
 * This is where the check belongs. Probatio is an engineering console and an
 * editor will never open it; the fix for a missing excerpt has to be offered
 * where the excerpt is written. The Probatio tab stays useful for auditing a
 * slug after the fact, but this is the one an editor uses.
 *
 * It posts the document currently displayed in the form rather than an id, so
 * it grades unsaved edits — the state the writer actually wants checked.
 *
 * Deliberately built from plain markup rather than @sanity/ui. That package is
 * only a transitive dependency of `sanity` here, and CI fails on unresolved
 * imports in shipped code, so importing it would be betting the build on
 * hoisting. Colours are expressed against currentColor and translucent
 * overlays so the view reads correctly in both Studio themes without knowing
 * which one is active.
 *
 * ⚠ Auth: /api/probatio/* is gated by requireProbatioAdmin, which expects a
 * wallet signature. The Studio has no wallet, so this view works while
 * PROBATIO_DEMO_MODE bypasses auth and will start returning 401 the moment
 * that is switched off. Giving the Studio a real auth path — verifying the
 * Sanity session server-side, most likely — is a decision to make before
 * relying on this in production.
 */
import { useCallback, useState } from 'react'

type Status = 'pass' | 'fail' | 'warn' | 'na'

interface Check {
  id: string
  label: string
  status: Status
  detail: string
  weight: number
}

interface Report {
  title: string
  score: number
  wordCount: number
  quotedPassages: number
  specificityMarkers: number
  primarySubject: string | null
  checks: Check[]
}

interface Advice {
  verdict: string
  proposedExcerpt: string | null
  proposedSubjects: Array<{ name: string; type: string }>
  proposedKeyFacts: Array<{ fact: string; when?: string }>
  editorialNotes: string[]
  model: string
}

const STATUS_COLOR: Record<Status, string> = {
  pass: '#3aa76d',
  fail: '#d05a5a',
  warn: '#c58b2b',
  na: '#8a8a8a',
}

const STATUS_MARK: Record<Status, string> = { pass: '✓', fail: '✕', warn: '!', na: '–' }

export function DraftCheckView(props: any) {
  const doc = props?.document?.displayed ?? props?.displayed ?? null

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [advice, setAdvice] = useState<Advice | null>(null)

  const run = useCallback(
    async (advise: boolean) => {
      setError(null)
      setReport(null)
      setAdvice(null)
      setLoading(true)
      try {
        const res = await fetch('/api/probatio/draft-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: doc, advise }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
        setReport(json.report)
        setAdvice(json.advice)
        if (advise && !json.advice) {
          setError('Checks ran; the advisor pass failed. The scores below are still valid.')
        }
      } catch (err: any) {
        setError(err?.message ?? 'Check failed.')
      } finally {
        setLoading(false)
      }
    },
    [doc],
  )

  if (!doc) {
    return (
      <div style={{ padding: 24, opacity: 0.7, font: 'inherit' }}>Open a document to check it.</div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 760, font: 'inherit', lineHeight: 1.5 }}>
      <p style={{ opacity: 0.75, fontSize: 13, marginTop: 0 }}>
        Grades this story on what decides whether an answer engine can cite it — whether it names its
        subject where an engine looks, carries quotes only you have, and pins dates. Checks what is on
        screen, including unsaved edits.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 24px' }}>
        <button onClick={() => run(true)} disabled={loading} style={primaryButton(loading)}>
          {loading ? 'Checking…' : 'Check and draft fixes'}
        </button>
        <button onClick={() => run(false)} disabled={loading} style={ghostButton(loading)}>
          Checks only
        </button>
      </div>

      {error && (
        <div style={noticeBox('#d05a5a')}>
          <span style={{ fontSize: 13 }}>{error}</span>
        </div>
      )}

      {report && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 24 }}>{report.score}/100</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              {report.wordCount} words · {report.quotedPassages} quoted ·{' '}
              {report.specificityMarkers} specificity markers · subject:{' '}
              {report.primarySubject ?? 'none tagged'}
            </span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
            {report.checks.map((c) => (
              <li key={c.id} style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
                <span style={dot(c.status)}>{STATUS_MARK[c.status]}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14 }}>{c.label}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice && <AdviceBlock advice={advice} />}
    </div>
  )
}

function AdviceBlock({ advice }: { advice: Advice }) {
  return (
    <div style={{ borderTop: '1px solid currentColor', paddingTop: 20, opacity: 0.999 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Proposed</h3>
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 0 }}>
        Drafted by {advice.model} from this piece&rsquo;s own text. Nothing is invented — if the body
        does not support a fact, it is not proposed. Copy what is useful into the fields.
      </p>
      {advice.verdict && <p style={{ fontSize: 14 }}>{advice.verdict}</p>}

      {advice.proposedExcerpt && (
        <Section title="Excerpt">
          <p style={{ margin: 0, fontSize: 14 }}>{advice.proposedExcerpt}</p>
        </Section>
      )}

      {advice.proposedSubjects.length > 0 && (
        <Section title="Subjects">
          {advice.proposedSubjects.map((s, i) => (
            <p key={i} style={{ margin: '0 0 6px', fontSize: 14 }}>
              {s.name} <span style={{ opacity: 0.6 }}>· {s.type}</span>
            </p>
          ))}
        </Section>
      )}

      {advice.proposedKeyFacts.length > 0 && (
        <Section title="Key facts">
          {advice.proposedKeyFacts.map((f, i) => (
            <p key={i} style={{ margin: '0 0 6px', fontSize: 14 }}>
              {f.when && <span style={{ opacity: 0.6 }}>{f.when} · </span>}
              {f.fact}
            </p>
          ))}
        </Section>
      )}

      {advice.editorialNotes.length > 0 && (
        <Section title="For the writer">
          {advice.editorialNotes.map((n, i) => (
            <p key={i} style={{ margin: '0 0 6px', fontSize: 14 }}>
              • {n}
            </p>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          opacity: 0.6,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ borderLeft: '2px solid rgba(128,128,128,0.4)', paddingLeft: 12 }}>{children}</div>
    </div>
  )
}

function dot(status: Status): React.CSSProperties {
  return {
    flex: 'none',
    marginTop: 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: STATUS_COLOR[status],
    color: '#fff',
    fontSize: 11,
    lineHeight: '18px',
    textAlign: 'center',
  }
}

function noticeBox(color: string): React.CSSProperties {
  return {
    border: `1px solid ${color}`,
    background: 'rgba(208,90,90,0.08)',
    borderRadius: 4,
    padding: '10px 12px',
    marginBottom: 20,
  }
}

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid rgba(128,128,128,0.5)',
    background: '#2276fc',
    color: '#fff',
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

function ghostButton(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 4,
    border: '1px solid rgba(128,128,128,0.5)',
    background: 'transparent',
    color: 'inherit',
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

export default DraftCheckView
