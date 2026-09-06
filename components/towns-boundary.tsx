'use client';

import dynamic from 'next/dynamic';

/**
 * Towns context, scoped to the routes that actually use it.
 *
 * This used to wrap the whole app from app/providers.tsx, which had a
 * consequence nobody could see from a browser: the app rendered nothing at all
 * on the server.
 *
 * The provider is loaded with `ssr: false` — it has to be, because lru-cache
 * v11's top-level await cascades through the Towns SDK import chain and turns
 * the provider into a Promise (React error #306). But `ssr: false` means Next
 * renders the `loading` fallback on the server instead of the component *and
 * its children*. The old fallback was written as
 * `({ children }) => <>{children}</>`, intending children to pass through —
 * except `next/dynamic` passes `{ error, isLoading, pastDelay }` to `loading`
 * and never `children`. So it received `undefined` and rendered nothing, and
 * every page below it was absent from the served HTML.
 *
 * The visible symptom was zero: the browser hydrated and the page appeared.
 * The invisible symptom was total: crawlers that do not execute JavaScript —
 * which is most AI crawlers — received a document containing the title and
 * nothing else. Article bodies shipped only inside the RSC payload, in a
 * <script> tag, where text extraction does not reach.
 *
 * Towns hooks are used only under /chat, so the boundary belongs there rather
 * than at the root. Everything else now server-renders normally.
 *
 * If this ever needs to move back up the tree, the body must still reach the
 * initial HTML — check with:
 *   curl -s <url> | sed 's/<script[^>]*>.*<\/script>//g; s/<[^>]*>/ /g' | wc -w
 */
const TownsSyncProvider = dynamic(
  () => import('@towns-protocol/react-sdk').then((m) => m.TownsSyncProvider),
  {
    ssr: false,
    // `loading` receives { error, isLoading, pastDelay } — never children.
    // Returning null is honest about that; the previous fallback only looked
    // like it passed children through.
    loading: () => null,
  },
);

export function TownsBoundary({ children }: { children: React.ReactNode }) {
  return <TownsSyncProvider>{children}</TownsSyncProvider>;
}
