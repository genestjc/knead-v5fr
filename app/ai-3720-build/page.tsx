import type { Metadata } from 'next';
import { TalentDeck } from '@/components/ai-deck/talent-deck';

/**
 * /ai-3720-build — the capability deck for Knead's AI work, sent as a link.
 *
 * The route is deliberately unguessable and the page is noindex/nofollow: it's
 * a pitch you hand to someone, not a page the site advertises. It's also left
 * out of app/sitemap.ts on purpose. Nothing here is gated, so treat the URL
 * itself as the only privacy it has.
 */
export const metadata: Metadata = {
  title: 'AI Studio',
  description:
    "Knead builds grounded AI assistants, agentic evaluation harnesses, and custom marketing-data platforms — and ships them to production.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AiTalentsDeckPage() {
  return <TalentDeck />;
}
