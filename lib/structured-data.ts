import { SITE_URL } from "@/lib/constants"

/**
 * JSON-LD builders for the pages answer engines read.
 *
 * Two things here matter more than the rest:
 *
 * 1. `isAccessibleForFree` + `hasPart`. This is the standard way to declare a
 *    paywall to a machine. Without it, a crawler that receives a truncated body
 *    has no way to distinguish "short article" from "article you were only shown
 *    the top of", and Knead's long-form work gets modelled as thin content.
 *    With it, the free portion is explicitly marked, and the engine knows there
 *    is more behind it.
 *
 * 2. Absolute URLs and stable `@id`s everywhere. Entity resolution is the whole
 *    game — an author who appears as a bare string on every page is not a
 *    person an engine can accumulate knowledge about across articles.
 */

const ORG_ID = `${SITE_URL}/#organization`

/**
 * Serialize a schema for injection into a <script type="application/ld+json">.
 *
 * Escaping `<` is the part that matters: a title or excerpt containing the
 * literal text "</script>" would otherwise close the element early and let
 * CMS content become markup. < is valid JSON and parses identically.
 */
export function jsonLdScript(schema: object): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c")
}

export interface ArticleSchemaInput {
  title: string
  slug: string
  excerpt?: string
  publishedAt?: string
  updatedAt?: string
  imageUrl?: string | null
  isPremium: boolean
  author?: {
    _id?: string
    name?: string
    bioText?: string
  } | null
  categories?: string[]
}

export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Knead",
    url: SITE_URL,
    description: "Nourishment for the creative spirit.",
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/faviconk.jpg`,
    },
  }
}

export function articleSchema(input: ArticleSchemaInput) {
  const url = `${SITE_URL}/posts/${input.slug}`

  const author = input.author?.name
    ? {
        "@type": "Person",
        // Author pages are routed by Sanity _id (app/authors/[id]).
        ...(input.author._id
          ? { "@id": `${SITE_URL}/authors/${input.author._id}#person`, url: `${SITE_URL}/authors/${input.author._id}` }
          : {}),
        name: input.author.name,
        ...(input.author.bioText ? { description: input.author.bioText } : {}),
      }
    : { "@type": "Organization", "@id": ORG_ID, name: "Knead" }

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: input.title,
    ...(input.excerpt ? { description: input.excerpt, abstract: input.excerpt } : {}),
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    dateModified: input.updatedAt || input.publishedAt,
    author,
    publisher: organizationSchema(),
    ...(input.categories?.length ? { articleSection: input.categories, keywords: input.categories.join(", ") } : {}),
    isAccessibleForFree: !input.isPremium,
    ...(input.isPremium
      ? {
          // Mirrors the page: premium posts render the first two blocks openly
          // and gate the remainder.
          hasPart: {
            "@type": "WebPageElement",
            isAccessibleForFree: false,
            cssSelector: ".article-body--gated",
          },
        }
      : {}),
  }
}
