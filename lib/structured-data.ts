import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_SLOGAN,
  SITE_TOPICS,
  SITE_SOCIAL_PROFILES,
} from "@/lib/constants"

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
const WEBSITE_ID = `${SITE_URL}/#website`

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
  /**
   * Named subjects the piece is *about* — an interviewee, a profiled artist.
   * This is the difference between a page that reads as journalism about a
   * person and one that reads as marketing for a product.
   */
  about?: Array<{ type: "Person" | "Organization"; name: string }>
}

/**
 * Knead, as an entity.
 *
 * NewsMediaOrganization is the point of this node. Plain Organization says
 * "a company exists here" and leaves the category to be guessed from whatever
 * page the crawler landed on; NewsMediaOrganization says "this is a publisher",
 * which is the claim that stops an interview about AI being read as evidence
 * that Knead sells AI tools.
 *
 * `description` carries the category, `slogan` carries the voice, `knowsAbout`
 * states the beat explicitly rather than leaving it to be inferred from a
 * sample of one article, and `sameAs` gives an engine somewhere to corroborate
 * all of it.
 */
export function organizationSchema() {
  return {
    "@type": ["Organization", "NewsMediaOrganization"],
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    slogan: SITE_SLOGAN,
    knowsAbout: SITE_TOPICS,
    sameAs: SITE_SOCIAL_PROFILES,
    publishingPrinciples: `${SITE_URL}/about`,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: `${SITE_URL}/faviconk.jpg`,
      caption: SITE_NAME,
    },
  }
}

/** The site itself, so articles have a publication to belong to. */
export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  }
}

/**
 * The site-wide graph, emitted on every page from the root layout.
 *
 * Every page carrying this is a page that answers "what is Knead?" without
 * needing the engine to find and correctly interpret a specific article. It
 * also means the `@id` references in articleSchema always resolve within the
 * same document.
 */
export function siteSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationSchema(), websiteSchema()],
  }
}

/** The /about page, which is where an engine looks to resolve the publisher. */
export function aboutPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE_URL}/about#page`,
    url: `${SITE_URL}/about`,
    name: `About ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: { "@id": ORG_ID },
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
    // References, not copies. The full nodes are emitted once by siteSchema()
    // in the root layout, which is present on this page too — so these resolve
    // in-document, and the article is explicitly part of a publication rather
    // than a page that happens to sit at this domain.
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(input.about?.length
      ? { about: input.about.map((e) => ({ "@type": e.type, name: e.name })) }
      : {}),
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
