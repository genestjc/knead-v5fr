import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import type { SanityDocument } from "next-sanity"
import { client } from "../../../sanity/client"
import { urlFor } from "../../../lib/sanity"
import { Header } from "../../../components/header"
import { PostCard } from "../../../components/post-card"

interface AuthorPageProps {
  params: {
    id: string
  }
}

// GROQ query to fetch author and their posts
const AUTHOR_QUERY = `*[_type == "author" && _id == $id][0]{
  _id,
  name,
  image,
  bio
}`

const AUTHOR_POSTS_QUERY = `*[_type == "post" && author._ref == $id] | order(publishedAt desc){
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
  excerpt,
  isPremium,
  premium,
  "author": author->{name, image},
  "categories": categories[]->title
}`

const options = { next: { revalidate: 60 } }

// Helper function to safely extract text from bio
function extractBioText(bio: any): string {
  if (!bio) return ""

  if (typeof bio === "string") return bio

  if (Array.isArray(bio)) {
    return bio
      .filter((block) => block && block._type === "block")
      .map((block) => {
        if (block.children && Array.isArray(block.children)) {
          return block.children
            .map((child: any) => {
              if (typeof child === "string") return child
              if (child && typeof child.text === "string") return child.text
              return ""
            })
            .join("")
        }
        return ""
      })
      .filter(Boolean)
      .join(" ")
  }

  // Handle case where bio might be an object with nested structure
  if (typeof bio === "object" && bio !== null) {
    // Try to extract text from various possible structures
    if (bio.text) return String(bio.text)
    if (bio.content) return extractBioText(bio.content)
    if (Array.isArray(bio.children)) return extractBioText(bio.children)

    // If it's still an object, try to stringify and clean it
    try {
      const stringified = JSON.stringify(bio)
      if (stringified !== "{}" && stringified !== "null") {
        // This is a fallback - ideally we shouldn't reach here
        console.warn("Bio object structure not recognized:", bio)
        return ""
      }
    } catch (e) {
      console.error("Error processing bio:", e)
    }
  }

  return ""
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  try {
    // Fetch author data
    const author = await client.fetch<SanityDocument>(AUTHOR_QUERY, { id: params.id }, options)

    if (!author) {
      notFound()
    }

    // Fetch author's posts
    const posts = await client.fetch<SanityDocument[]>(AUTHOR_POSTS_QUERY, { id: params.id }, options)

    // Get author avatar URL safely
    const getAuthorAvatarUrl = () => {
      try {
        if (author.image?.asset) {
          return urlFor(author.image).width(256).height(256).url()
        }
        return "/placeholder.svg?height=256&width=256"
      } catch (error) {
        console.error("Error generating author avatar URL:", error)
        return "/placeholder.svg?height=256&width=256"
      }
    }

    // Extract bio text safely
    const bioText = extractBioText(author.bio)

    return (
      <>
        <Header />
        <main className="min-h-screen bg-white">
          <div className="container-magazine py-16">
            {/* Author Header */}
            <div className="text-center mb-16 animate-fade-in-up">
              <div className="w-32 h-32 mx-auto mb-8 rounded-full overflow-hidden">
                <Image
                  src={getAuthorAvatarUrl() || "/placeholder.svg"}
                  alt={String(author.name || "Author")}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>

              <h1 className="text-magazine-title font-adonis mb-4">{String(author.name || "Unknown Author")}</h1>

              {bioText && (
                <p className="text-magazine-subtitle text-gray-600 max-w-2xl mx-auto font-georgia-pro">{bioText}</p>
              )}

              <div className="mt-8 text-sm text-gray-500 font-georgia-pro">
                {posts.length} {posts.length === 1 ? "Article" : "Articles"}
              </div>
            </div>

            {/* Author's Posts */}
            {posts.length > 0 && (
              <div className="animate-fade-in-up-delay">
                <h2 className="text-2xl font-adonis mb-8 text-center">
                  Articles by {String(author.name || "Unknown")}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {posts.map((post) => {
                    // Transform post data to match PostCard expectations
                    const transformedPost = {
                      id: post._id,
                      title: String(post.title || "Untitled"),
                      slug: post.slug?.current || "",
                      excerpt: String(post.excerpt || ""),
                      publishedAt: post.publishedAt || new Date().toISOString(),
                      image: post.mainImage?.asset
                        ? urlFor(post.mainImage).width(600).height(400).url()
                        : "/placeholder.svg",
                      imageAlt: String(post.mainImage?.alt || post.title || "Post image"),
                      author: {
                        id: author._id,
                        name: String(author.name || "Unknown"),
                        avatar: getAuthorAvatarUrl(),
                      },
                      categories: Array.isArray(post.categories) ? post.categories.map(String) : [],
                      isPremium: Boolean(post.isPremium || post.premium),
                    }

                    return <PostCard key={post._id} post={transformedPost} />
                  })}
                </div>
              </div>
            )}

            {/* No Posts Message */}
            {posts.length === 0 && (
              <div className="text-center animate-fade-in-up-delay">
                <p className="text-gray-600 font-georgia-pro">No articles published yet.</p>
              </div>
            )}

            {/* Back to Archive */}
            <div className="text-center mt-16 animate-fade-in-up-delay-2">
              <Link
                href="/archive"
                className="inline-flex items-center font-georgia-pro text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <svg
                  className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to The Archive
              </Link>
            </div>
          </div>
        </main>
      </>
    )
  } catch (error) {
    console.error("Error loading author page:", error)
    notFound()
  }
}

export async function generateStaticParams() {
  try {
    const authors = await client.fetch<SanityDocument[]>(
      `*[_type == "author" && defined(_id)][0...20]{
        _id
      }`,
    )

    return authors.map((author) => ({
      id: author._id,
    }))
  } catch (error) {
    console.error("Error generating static params for authors:", error)
    return []
  }
}
