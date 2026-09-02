import 'dotenv/config';
import { createClient } from '@sanity/client';
import { generateText } from '../lib/ai/router';
import { portableTextToPlain } from '../lib/demeter-knowledge';

/**
 * Backfill the `excerpt` field across the archive.
 *
 * `excerpt` was read in four places (the post page's meta description, Demeter's
 * search results, the article-summary audio route) but was never declared in
 * sanity/schemas/post.js — so it was undefined on every document, and every meta
 * description on the site fell through to a boilerplate string. This populates
 * it once; the Studio field keeps it populated from here.
 *
 * Dry run (default) prints what it would write and costs nothing but tokens:
 *   npx tsx scripts/backfill-excerpts.ts
 *
 * Write for real:
 *   npx tsx scripts/backfill-excerpts.ts --commit
 *
 * Re-generate excerpts that already exist:
 *   npx tsx scripts/backfill-excerpts.ts --commit --overwrite
 *
 * Limit the batch while you check quality:
 *   npx tsx scripts/backfill-excerpts.ts --limit 5
 *
 * Requires SANITY_API_WRITE_TOKEN (Editor token, Sanity project → API → Tokens)
 * when run with --commit.
 */

const COMMIT = process.argv.includes('--commit');
const OVERWRITE = process.argv.includes('--overwrite');
const limitFlag = process.argv.indexOf('--limit');
const LIMIT = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;

const SYSTEM = `You write excerpts for Knead, an independent magazine publishing long-form creative journalism about food, art, and the people making both.

An excerpt has one job: tell a reader — or an answer engine deciding whether to cite this piece — what the story actually establishes. Write the claim, not the tease.

Rules:
- One or two sentences. Under 300 characters.
- Lead with the specific: who, where, what happened. Names and places over abstractions.
- Present tense for what the piece argues; past tense for what it reports.
- No "explores", "delves into", "dives into", "takes a look at", "this article".
- No cliffhangers, no second-person address, no questions.
- Never state anything the article does not.

Return only the excerpt. No quotes around it, no preamble, no alternatives.`;

interface PostRow {
  _id: string;
  title?: string;
  excerpt?: string;
  body?: unknown[];
  author?: string;
  categories?: string[];
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = process.env.SANITY_API_WRITE_TOKEN;

  if (!projectId) {
    console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID.');
    process.exit(1);
  }
  if (COMMIT && !token) {
    console.error('--commit needs SANITY_API_WRITE_TOKEN (an Editor token).');
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  });

  const filter = OVERWRITE
    ? '*[_type == "post" && defined(body)]'
    : '*[_type == "post" && defined(body) && !defined(excerpt)]';

  const posts: PostRow[] = await client.fetch(
    `${filter} | order(publishedAt desc) {
      _id, title, excerpt, body, "author": author->name, "categories": categories[]->title
    }`
  );

  const queue = posts.slice(0, LIMIT);

  console.log(
    `${posts.length} post(s) need an excerpt; processing ${queue.length}. ` +
      `Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'}${OVERWRITE ? ' + OVERWRITE' : ''}\n`
  );
  if (queue.length === 0) return;

  let written = 0;
  let failed = 0;

  for (const [i, post] of queue.entries()) {
    const label = `[${i + 1}/${queue.length}] ${post.title || post._id}`;

    // Cap the body — a 5,000-word feature establishes its subject in the first
    // ~1,200 words, and the rest is spend for no gain.
    const bodyText = portableTextToPlain(post.body as any[]).slice(0, 8000);
    if (!bodyText.trim()) {
      console.log(`${label}\n  SKIPPED — empty body\n`);
      continue;
    }

    const prompt = [
      `Title: ${post.title || 'Untitled'}`,
      post.author ? `Author: ${post.author}` : '',
      post.categories?.length ? `Categories: ${post.categories.join(', ')}` : '',
      '',
      'Article:',
      bodyText,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await generateText({
        system: SYSTEM,
        prompt,
        maxTokens: 200,
        logTag: 'backfill-excerpts',
      });

      const excerpt = raw.trim().replace(/^["“]|["”]$/g, '').trim();

      if (!excerpt) {
        console.log(`${label}\n  FAILED — model returned nothing\n`);
        failed++;
        continue;
      }

      console.log(`${label}\n  ${excerpt}${excerpt.length > 300 ? `\n  ⚠️  ${excerpt.length} chars — over the 300 limit` : ''}\n`);

      if (COMMIT) {
        await client.patch(post._id).set({ excerpt }).commit();
        written++;
      }
    } catch (error) {
      console.error(`${label}\n  FAILED — ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
  }

  console.log(
    COMMIT
      ? `Done. Wrote ${written} excerpt(s), ${failed} failure(s).`
      : `Dry run complete — nothing written. ${failed} failure(s). Re-run with --commit to save.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
