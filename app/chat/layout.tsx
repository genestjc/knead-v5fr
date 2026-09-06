import { TownsBoundary } from '@/components/towns-boundary';

/**
 * Towns context is mounted here rather than at the root.
 *
 * The provider must load client-only (see components/towns-boundary.tsx), and
 * a client-only boundary withholds everything inside it from the server-
 * rendered HTML. That is acceptable for chat, which is member-gated and has
 * nothing an answer engine should index. It was not acceptable at the root,
 * where it silently emptied every article page.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <TownsBoundary>{children}</TownsBoundary>;
}
