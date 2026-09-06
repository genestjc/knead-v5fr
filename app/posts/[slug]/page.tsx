import { notFound } from "next/navigation"
import type { SanityDocument } from "next-sanity"
import { client } from "../../../sanity/client"
import { urlFor } from "../../../lib/sanity"
import Image from "next/image"
import { Header } from "../../../components/header"
import type { Metadata } from "next"
import { UnlockContent } from "../../../components/unlock-content"
import { PremiumBadge } from "../../../components/premium-badge"
import { PortableTextRenderer } from "../../../components/portable-text-renderer"
import { DemeterBubble } from "../../../components/demeter/DemeterBubble"
import { ArticleListenButton } from "../../../components/demeter/ArticleListenButton"
import { FreeArticleCTA } from "../../../components/free-article-cta"
import { BackToStoriesLink } from "../../../components/back-to-stories-link"
import { articleSchema, jsonLdScript, type KeyFact } from "@/lib/structured-data"
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants"
import { KeyFacts } from "@/components/key-facts"

// Define the params type for the page
interface PostPageProps {
  params: {
    slug: string
  }
}

// Updated GROQ query to fetch premium field (checking both isPremium and premium)
const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id,
  _updatedAt,
  title,
  slug,
  publishedAt,
  mainImage{
    asset->{
      _id,
      url
    },
    alt
  },
  body,
  excerpt,
  isPremium,
  premium,
  "author": author->{_id, name, image, bio},
  "categories": categories[]->title,
  subjects[]{name, type},
  keyFacts[]{fact, when, sourceUrl}
}`

// Author bios are Portable Text; JSON-LD needs a plain string. Kept local
// rather than imported from lib/demeter-knowledge so this page doesn't pull in
// the Supabase admin client and web-search modules just to flatten a bio.
function plainTextFromBlocks(blocks: unknown): string | undefined {
  if (!Array.isArray(blocks)) return undefined
  const text = blocks
    .filter((b: any) => b?._type === "block" && Array.isArray(b.children))
    .map((b: any) => b.children.map((c: any) => c?.text ?? "").join(""))
    .join(" ")
    .trim()
  return text || undefined
}

// Search engines truncate around here; answer engines read the whole string.
const DESCRIPTION_MAX = 155

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${trimmed.replace(/[\s.,;:!?—–-]+$/, "")}…`
}

/**
 * The one sentence a machine reads to decide what this story is about.
 *
 * A hand-written excerpt always wins. Failing that, derive from the article's
 * own opening rather than emitting boilerplate — a real first line describes
 * the piece, and "Read X on Knead" describes nothing, which is the difference
 * between a page an answer engine can place and one it can't.
 *
 * For premium posts the fallback reads only the ungated opening blocks, the
 * same two the page renders publicly. A meta description is public by
 * definition and must never be a way to read gated prose.
 */
function deriveDescription(post: SanityDocument): string {
  if (typeof post.excerpt === "string" && post.excerpt.trim()) {
    return post.excerpt.trim()
  }

  const isPremium = Boolean(post.isPremium || post.premium)
  const source = Array.isArray(post.body) ? (isPremium ? post.body.slice(0, 2) : post.body) : []
  const opening = plainTextFromBlocks(source)

  if (opening) {
    return truncateAtWord(opening.replace(/\s+/g, " ").trim(), DESCRIPTION_MAX)
  }

  return `Read ${post.title || "this post"} on Knead - Stories worth savoring`
}

const options = { next: { revalidate: 60 } }

// Generate metadata for SEO - This function is already quite robust.
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const post = await client.fetch<SanityDocument>(POST_QUERY, { slug: params.slug }, options)

    if (!post) {
      return {
        title: "Post Not Found",
        description: "The requested post could not be found.",
      }
    }

    let imageUrl = null
    try {
      imageUrl = post.mainImage?.asset ? urlFor(post.mainImage).width(1200).height(630).url() : null
    } catch (error) {
      console.error("Error generating image URL for metadata:", error)
    }

    const description = deriveDescription(post)

    return {
      title: post.title || 'Untitled Post',
      description,
      openGraph: {
        title: post.title || 'Untitled Post',
        description,
        type: "article",
        publishedTime: post.publishedAt,
        authors: post.author?.name ? [post.author.name] : undefined,
        images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: post.title || 'Post Image' }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title || 'Untitled Post',
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
      alternates: {
        canonical: `/posts/${params.slug}`,
      },
    }
  } catch (error) {
    console.error("Error generating metadata:", error)
    return {
      // Absolute, so the root layout's "%s | Knead" template doesn't double it.
      title: { absolute: SITE_NAME },
      description: SITE_DESCRIPTION,
    }
  }
}

export default async function PostPage({ params }: PostPageProps) {
  try {
    const post = await client.fetch<SanityDocument>(POST_QUERY, { slug: params.slug }, options)

    if (!post) {
      notFound()
    }

    const isPremiumPost = Boolean(post.isPremium || post.premium)
    const authorName = post.author?.name ?? "Knead Team";

    let formattedDate = "No date"
    if (post.publishedAt) {
      try {
        formattedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      } catch (error) {
        console.error("Error formatting date:", error)
      }
    }

    const getImageUrl = () => {
      try {
        if (post.mainImage?.asset) {
          return urlFor(post.mainImage).width(1200).height(675).url()
        }
        return "/magazine-article.png"
      } catch (error) {
        console.error("Error generating image URL:", error)
        return "/magazine-article.png"
      }
    }

    const keyFacts: KeyFact[] = Array.isArray(post.keyFacts)
      ? post.keyFacts
          .filter((f: any) => typeof f?.fact === "string" && f.fact.trim())
          .map((f: any) => ({
            fact: f.fact.trim(),
            when: typeof f.when === "string" && f.when.trim() ? f.when.trim() : undefined,
            sourceUrl: typeof f.sourceUrl === "string" && f.sourceUrl.trim() ? f.sourceUrl.trim() : undefined,
          }))
      : []

    const jsonLd = articleSchema({
      title: post.title || "Untitled",
      slug: params.slug,
      excerpt: deriveDescription(post),
      publishedAt: post.publishedAt,
      updatedAt: post._updatedAt,
      imageUrl: post.mainImage?.asset ? getImageUrl() : null,
      isPremium: isPremiumPost,
      author: post.author
        ? { _id: post.author._id, name: post.author.name, bioText: plainTextFromBlocks(post.author.bio) }
        : null,
      categories: Array.isArray(post.categories) ? post.categories.filter(Boolean) : [],
      about: Array.isArray(post.subjects)
        ? post.subjects
            .filter((s: any) => s?.name)
            .map((s: any) => ({ type: s.type === "Organization" ? "Organization" : "Person", name: s.name }))
        : [],
      keyFacts,
    })

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
        <Header />
        <DemeterBubble slug={params.slug} contentId={post._id} isPremiumPost={isPremiumPost} />
        <main className="min-h-screen bg-white">
          <article className="py-12 md:py-16">
            <div className="container-magazine">
              <header className="mb-10">
                <h1 className="font-adonis text-4xl md:text-5xl font-normal leading-tight mb-6">
                  {post.title || "Untitled"}
                </h1>
                <div className="article-meta mb-8">
                  <time dateTime={post.publishedAt} className="font-georgia-pro text-gray-600">
                    {formattedDate}
                  </time>
                  {post.author && (
                    <>
                      <span className="mx-2 text-gray-400">•</span>
                      <span className="font-georgia-pro text-gray-600">By {authorName}</span>
                    </>
                  )}
                </div>
                {isPremiumPost && <div className="mb-6"><PremiumBadge /></div>}
                {post.categories && Array.isArray(post.categories) && post.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {post.categories.map((category: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors">
                        {category || ""}
                      </span>
                    ))}
                  </div>
                )}
              </header>
              <ArticleListenButton slug={params.slug} contentId={post._id} isPremium={isPremiumPost} />
              {post.mainImage && (
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg mb-12">
                  <Image
                    src={getImageUrl()}
                    alt={post.mainImage.alt || post.title || "Post image"}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                  />
                </div>
              )}
              {/* Above the body on purpose: this is the densest factual text
                  on the page and engines weight the opening. */}
              <KeyFacts facts={keyFacts} />
              <div className="article-content">
                {isPremiumPost ? (
                  <>
                    <div className="article-body mb-8">
                      {post.body && Array.isArray(post.body) && post.body.length > 0 ? (
                        <PortableTextRenderer content={post.body.slice(0, 2)} />
                      ) : (
                        <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700">
                          {post.excerpt || "Article content is being prepared..."}
                        </p>
                      )}
                    </div>
                    <UnlockContent contentId={post._id || ""}>
                      {/* Class is referenced by the hasPart cssSelector in the
                          Article JSON-LD — keep the two in sync. */}
                      <div className="article-body article-body--gated">
                        {post.body && Array.isArray(post.body) && post.body.length > 2 ? (
                          <PortableTextRenderer content={post.body.slice(2)} />
                        ) : (
                           <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700">
                            Continue reading to see more content...
                          </p>
                        )}
                      </div>
                    </UnlockContent>
                  </>
                ) : (
                  <>
                    <div className="article-body">
                      {post.body && Array.isArray(post.body) && post.body.length > 0 ? (
                        <PortableTextRenderer content={post.body} />
                      ) : (
                        <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700">
                          {post.excerpt || "Article content is being prepared..."}
                        </p>
                      )}
                    </div>
                    <FreeArticleCTA />
                  </>
                )}
              </div>
              <div className="mt-12 pt-8 border-t border-gray-100">
                <BackToStoriesLink />
              </div>
            </div>
          </article>
        </main>
      </>
    )
  } catch (error) {
    console.error("Error loading post:", error)
    notFound()
  }
}

// Generate static params for all posts with a defined slug
export async function generateStaticParams() {
  try {
    // Fetch all post slugs from Sanity
    const posts = await client.fetch<Array<{ slug: { current: string } }>>(
      `*[_type == "post" && defined(slug.current)]{ "slug": slug }`
    );

    // Ensure posts is an array before mapping
    if (!Array.isArray(posts)) {
      return [];
    }

    // Map over the posts and return the correct format that Next.js expects: { slug: string }
    return posts
      .filter(post => post?.slug?.current) // Defensive filter for safety
      .map((post) => ({
        slug: post.slug.current, // THE FIX IS HERE: Access the `current` property
      }));
      
  } catch (error) {
    console.error("Error generating static params:", error);
    return []; // Return an empty array on failure to prevent build crash
  }
}
