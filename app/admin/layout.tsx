'use client';

// NOTE: TownsSyncProvider is already provided once at the app root
// (app/providers.tsx). Wrapping again here created a second, nested sync
// context on /admin — double-initializing the Towns agent and multiplying
// stream requests. This layout is now a passthrough.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
