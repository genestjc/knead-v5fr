import { notFound } from "next/navigation"
import Link from "next/link"
import type { SanityDocument } from "next-sanity"
import { client } from "../../../sanity/client"
import { urlFor } from "../../../lib/sanity"
import Image from "next/image"
import { Header } from "../../../components/header"
import type { Metadata } from "next"
import { UnlockContent } from "../../../components/unlock-content"
import { PremiumBadge } from "../../../components/premium-badge"
import { PortableTextRenderer } from "../../../components/portable-text-renderer"

// Define the params type for the page
interface PostPageProps {
  params: {
    slug: string
  }
}

// Updated GROQ query to fetch premium field (checking both isPremium and premium)
const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id,
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
  "author": author->{name, image, bio},
  "categories": categories[]->title
}`

const options = { next: { revalidate: 60 } }

// Generate metadata for SEO - This function is already quite robust. No changes needed.
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const post = await client.fetch<SanityDocument>(POST_QUERY, { slug: params.slug }, options)

    if (!post) {
      return {
        title: "Post Not Found | Knead",
        description: "The requested post could not be found.",
      }
    }

    let imageUrl = null
    try {
      imageUrl = post.mainImage?.asset ? urlFor(post.mainImage).width(1200).height(630).url() : null
    } catch (error) {
      console.error("Error generating image URL for metadata:", error)
    }

    return {
      title: `${post.title || 'Untitled Post'} | Knead`,
      description: post.excerpt || `Read ${post.title || 'this post'} on Knead - Stories worth savoring`,
      openGraph: {
        title: post.title || 'Untitled Post',
        description: post.excerpt || `Read ${post.title || 'this post'} on Knead`,
        type: "article",
        publishedTime: post.publishedAt,
        authors: post.author?.name ? [post.author.name] : undefined,
        images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: post.title || 'Post Image' }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title || 'Untitled Post',
        description: post.excerpt || `Read ${post.title || 'this post'} on Knead`,
        images: imageUrl ? [imageUrl] : undefined,
      },
      alternates: {
        canonical: `/posts/${params.slug}`,
      },
    }
  } catch (error) {
    console.error("Error generating metadata:", error)
    return {
      title: "Knead",
      description: "Stories worth savoring",
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
    const authorName = post.author?.name ?? "Knead Team"; // FIX: Provide a safe fallback for author name

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

    return (
      <>
        <Header />
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
                      <div className="article-body">
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
                  <div className="article-body">
                    {post.body && Array.isArray(post.body) && post.body.length > 0 ? (
                      <PortableTextRenderer content={post.body} />
                    ) : (
                      <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700">
                        {post.excerpt || "Article content is being prepared..."}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-12 pt-8 border-t border-gray-100">
                <Link href="/" className="inline-flex items-center font-georgia-pro text-gray-600 hover:text-gray-900 transition-colors group">
                  <svg className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to all stories
                </Link>
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

// **THE MAIN FIX IS HERE**
// Generate static params for common posts with robust checking
export async function generateStaticParams() {
  try {
    const posts = await client.fetch<SanityDocument[]>(
      `*[_type == "post" && defined(slug.current)][]{ "slug": slug.current }`
    );

    // If posts are not an array or is empty, return an empty array
    if (!Array.isArray(posts)) {
      return [];
    }

    return posts
      .filter(post => post?.slug) // Filter out any posts that are null or missing a slug
      .map((post) => ({
        slug: post.slug,
      }));
  } catch (error) {
    console.error("Error generating static params:", error);
    return []; // Return an empty array on failure to prevent build crash
  }
}
