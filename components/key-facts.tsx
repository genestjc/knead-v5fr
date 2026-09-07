import type { KeyFact } from "@/lib/structured-data"

/**
 * The fact box — dated, checkable specifics, in extractable HTML.
 *
 * This exists because of a measured gap. A story audit of our Richard Nadler
 * interview against competitors found ours quote-dense and well reported
 * (1,650 words, 29 quoted passages) and still likely to lose the citation:
 * the competing pieces named a prior career, a studio and its city, and
 * collections with years. Ours named none of them. An engine assembling a
 * factual profile pulls from the pieces that carry names and dates, so a
 * strong interview that never pins one loses to a thinner piece that does.
 *
 * Two properties matter and both are deliberate:
 *
 *   • It renders as real text in the server HTML, high on the page. That is
 *     what an extractor reads, and engines weight the opening.
 *   • Dates that parse as ISO get a machine-readable <time datetime>. A date
 *     an engine can resolve is worth more than one it has to infer from prose.
 *
 * The same facts are emitted as JSON-LD from lib/structured-data.
 */
export function KeyFacts({ facts }: { facts: KeyFact[] }) {
  const usable = facts.filter((f) => f?.fact?.trim())
  if (usable.length === 0) return null

  return (
    <aside
      aria-labelledby="key-facts-heading"
      className="my-10 border-t border-b border-gray-200 py-6"
    >
      <h2
        id="key-facts-heading"
        className="font-adonis text-sm uppercase tracking-[0.16em] text-gray-500 mb-4"
      >
        Key facts
      </h2>
      <ul className="space-y-3 list-none pl-0">
        {usable.map((f, i) => (
          <li key={i} className="font-georgia-pro text-[17px] leading-relaxed text-gray-800">
            {f.when && <MachineDate when={f.when} />}
            {f.sourceUrl ? (
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600"
              >
                {f.fact}
              </a>
            ) : (
              f.fact
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}

/**
 * Render the date, machine-readable when we can prove it is.
 *
 * `<time datetime>` requires a valid datetime string. Editors write "2023",
 * "2024-03", and also "spring 2024" or "2019–2021", so emit the attribute only
 * for the forms that actually are ISO and render the rest as plain text. A
 * wrong datetime attribute is worse than none — it asserts a precision the
 * copy never had.
 */
function MachineDate({ when }: { when: string }) {
  const value = when.trim()
  const isIso = /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)
  const label = <span className="text-gray-500">{value}</span>

  return (
    <>
      {isIso ? <time dateTime={value} className="text-gray-500">{value}</time> : label}
      <span className="mx-2 text-gray-300">·</span>
    </>
  )
}
