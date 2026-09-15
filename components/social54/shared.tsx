'use client';

/**
 * Shared pieces for the Social 54 console.
 *
 * Same editorial identity as the rest of Knead's internal tools — Adonis
 * headings, Georgia Pro for anything a person reads, monospace for anything
 * that has to line up in a column — with one addition specific to this
 * console: nothing renders a missing number as zero.
 *
 * That rule lives in `Metric` and `MetricCell` rather than in each tab,
 * because it is the difference between "nobody saved this post" and "this
 * platform doesn't tell us about saves", and a dashboard that blurs the two
 * teaches its readers something false on every screen.
 */
import { useState } from 'react';
import { compactNumber } from '@/lib/social/metrics';
import { platformLabel, type SocialPlatform } from '@/lib/social/types';

export const KNEAD_RED = '#FF6B6B';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium mb-2">
      {children}
    </div>
  );
}

export function Banner({
  tone = 'error',
  children,
  onDismiss,
}: {
  tone?: 'error' | 'info' | 'success' | 'warn';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const tones = {
    error: 'bg-red-50 border-red-200 text-red-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
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

/**
 * A number with its own absence handled.
 *
 * `null` renders as a dash with a tooltip saying the platform doesn't report
 * it — never as 0, and never omitted, which would leave the reader to guess.
 */
export function Metric({
  label,
  value,
  unavailableReason = 'Not reported by this platform',
  suffix,
}: {
  label: string;
  value: number | null;
  unavailableReason?: string;
  suffix?: string;
}) {
  const known = value !== null && Number.isFinite(value);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400">{label}</div>
      <div
        className={`font-mono text-lg ${known ? 'text-gray-900' : 'text-gray-300'}`}
        title={known ? undefined : unavailableReason}
      >
        {known ? `${compactNumber(value)}${suffix ?? ''}` : '—'}
      </div>
    </div>
  );
}

/** The same rule in a table cell. */
export function MetricCell({
  value,
  suffix,
  unavailableReason = 'Not reported by this platform',
  emphasis,
}: {
  value: number | null;
  suffix?: string;
  unavailableReason?: string;
  emphasis?: boolean;
}) {
  const known = value !== null && Number.isFinite(value);
  return (
    <td
      className={`px-3 py-2 font-mono text-xs text-right ${
        known ? (emphasis ? 'text-gray-900 font-bold' : 'text-gray-700') : 'text-gray-300'
      }`}
      title={known ? undefined : unavailableReason}
    >
      {known ? `${compactNumber(value)}${suffix ?? ''}` : '—'}
    </td>
  );
}

const PLATFORM_TONES: Record<SocialPlatform, string> = {
  instagram: 'bg-pink-50 text-pink-800 border-pink-200',
  x: 'bg-gray-100 text-gray-900 border-gray-300',
  farcaster: 'bg-purple-50 text-purple-800 border-purple-200',
  zora: 'bg-blue-50 text-blue-800 border-blue-200',
  linkedin: 'bg-sky-50 text-sky-800 border-sky-200',
};

export function PlatformPill({ platform }: { platform: SocialPlatform | string }) {
  const tone = PLATFORM_TONES[platform as SocialPlatform] ?? 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono ${tone}`}
    >
      {platformLabel(platform)}
    </span>
  );
}

/**
 * Where a number came from.
 *
 * Shown next to every platform's data because an owner-authenticated read and
 * a public one are not interchangeable — the public path never returns reach,
 * so a "reach" figure that quietly came from one would be something else
 * entirely.
 */
export function SourcePill({ source }: { source: 'api' | 'public' | 'none' }) {
  const config = {
    api: { label: 'authenticated', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: 'Read through the platform API on our credentials.' },
    public: { label: 'public read', tone: 'bg-amber-50 text-amber-800 border-amber-200', title: 'Read from a public endpoint — no owner-only metrics such as reach or impressions.' },
    none: { label: 'no data', tone: 'bg-gray-50 text-gray-400 border-gray-200', title: 'Nothing was collected from this platform.' },
  }[source];

  return (
    <span
      title={config.title}
      className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono ${config.tone}`}
    >
      {config.label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const tones = {
    high: 'bg-red-50 text-red-800 border-red-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    low: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono ${tones[priority]}`}
    >
      {priority}
    </span>
  );
}

/**
 * The caveats panel.
 *
 * Collapsed by default but never hidden, and it carries a count so an
 * unopened panel still says how much of this screen rests on incomplete data.
 */
export function CaveatPanel({ caveats }: { caveats: string[] }) {
  const [open, setOpen] = useState(false);
  if (caveats.length === 0) return null;

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[11px] uppercase tracking-[0.16em] text-amber-800 font-medium">
          {caveats.length} data caveat{caveats.length === 1 ? '' : 's'} — what this pull could not see
        </span>
        <span className="text-[11px] text-amber-700 font-mono">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-1.5">
          {caveats.map((c, i) => (
            <li key={i} className="font-georgia-pro text-[13px] text-amber-900 leading-snug">
              • {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="py-16 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4" />
      <p className="font-georgia-pro text-gray-500">{label}</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-500 font-georgia-pro italic py-10 text-center">{children}</p>
  );
}

export function RunButton({
  onClick,
  busy,
  children,
  disabled,
}: {
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="px-5 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {busy ? 'Running…' : children}
    </button>
  );
}

export function ProviderPicker({
  value,
  onChange,
  disabled,
}: {
  value: 'claude' | 'openai';
  onChange: (v: 'claude' | 'openai') => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md overflow-hidden border border-gray-300 divide-x divide-gray-300">
      {(['claude', 'openai'] as const).map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p)}
          className={`px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            value === p ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p === 'claude' ? 'Claude' : 'GPT'}
        </button>
      ))}
    </div>
  );
}

export function WindowPicker({
  value,
  onChange,
  disabled,
  options = [7, 14, 30, 60],
  label = 'Window',
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  options?: number[];
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono disabled:opacity-50"
      >
        {options.map((d) => (
          <option key={d} value={d}>
            {d}d
          </option>
        ))}
      </select>
    </label>
  );
}

/** Monospace block for rendered agent output — preserves the layout it wrote. */
export function ReportBlock({ text }: { text: string }) {
  return (
    <pre className="text-[12px] font-mono bg-gray-900 text-gray-100 rounded-md p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
      {text}
    </pre>
  );
}

/** Shown when an agent's reply could not be parsed — the prose is not lost. */
export function ParseErrorNotice({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="mb-4">
      <Banner tone="warn">
        <strong className="font-medium">The model did not return structured output.</strong> {error}{' '}
        Its reply is shown below as written rather than reported as an empty result.
      </Banner>
    </div>
  );
}
