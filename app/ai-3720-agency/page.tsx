import type { Metadata } from 'next';
import { TalentDeck } from '@/components/ai-deck/talent-deck';
import { getDemoArticle } from '@/lib/deck-demo-article';

/**
 * /ai-3720-agency — the agency cut of the capability deck at /ai-3720-build.
 *
 * Same products, ordered and worded for an agency: Probatio leads and takes
 * the whole screen, and the problems slide is written in the words an agency
 * would use rather than as a list of capabilities.
 *
 * Three of its slides are the live products rather than pictures of them: the
 * Demeter and audio-summary panels and the build assistant call the same
 * production routes a visitor would hit on the site, and the Probatio console
 * is embedded whole. That means opening this page can spend model budget — the
 * per-IP limits on those routes are what bounds it.
 *
 * The route is deliberately unguessable and the page is noindex/nofollow: it's
 * a pitch you hand to someone, not a page the site advertises. It's also left
 * out of app/sitemap.ts on purpose. Nothing here is gated, so treat the URL
 * itself as the only privacy it has.
 */
export const metadata: Metadata = {
  title: 'AI Studio for Agencies',
  description:
    'Knead builds agentic testing, grounded assistants, and custom data platforms for agencies — and ships them to production.',
  robots: { index: false, follow: false, nocache: true },
};

// The demo article is resolved from the CMS; re-check it hourly so a rename or
// a newer feature lands here without a deploy.
export const revalidate = 3600;

export default async function AiAgencyDeckPage() {
  const article = await getDemoArticle();

  return <TalentDeck article={article} variant="agency" />;
}
