'use client';

// NOTE: this layout is a passthrough, and deliberately provides no Towns
// context.
//
// It used to wrap children in TownsSyncProvider, which double-initialized the
// agent because the root already provided one. The root no longer does — the
// provider is client-only, and mounting it at the root withheld every page
// from the server-rendered HTML, so it now lives at app/chat/layout (see
// components/towns-boundary.tsx).
//
// Nothing under /admin needs Towns today. A page that does should mount
// <TownsBoundary> itself rather than reinstating it here, so the cost of a
// client-only boundary lands only on the page that requires it —
// app/admin/create-channel does exactly that.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
