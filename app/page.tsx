import { Header } from "@/components/header"
import { PostCardFullBleed } from "@/components/post-card-full-bleed"
import { PostCard } from "@/components/post-card"
import { client } from "../sanity/client"
import type { SanityDocument } from "next-sanity"
import Link from "next/link"
import { ScrollFadeWrapper } from "@/components/scroll-fade-wrapper"

// Enhanced query to get more image data
const SPECIFIC_POSTS_QUERY = `*[_type == "post" && title in $titles]{
 _id,
 title,
 slug,
 publishedAt,
 excerpt,
 mainImage{
   asset->{
     _id,
     url
   },
   alt
 },
 "categories": categories[]->title,
 "author": author->name
}`

// Restored original story titles
const topFiveStoryTitles = ["Blvck Svm", "Constant Practice", "Eli McMullen", "Tarantula", "Ben Rubin of Towns"]

const bottomThreeStoryTitles = [
  "Dylan Abruscato Talks Crypto: The Game Season 3- Resurrection Island",
  "Clay Hoss of Helen's",
  "Decentraland Music Festival",
]

// Fallback mock data with original layout
const fallbackTopFiveStories = [
  {
    _id: "blvck-svm",
    title: "Blvck Svm",
    slug: { current: "blvck-svm" },
    publishedAt: "2024-01-15T10:00:00Z",
    excerpt: "An exploration of the creative vision behind Blvck Svm",
    mainImage: null,
    categories: ["Music", "Culture"],
    author: "Knead Team",
  },
  {
    _id: "constant-practice",
    title: "Constant Practice",
    slug: { current: "constant-practice" },
    publishedAt: "2024-01-14T10:00:00Z",
    excerpt: "The philosophy and methodology of constant practice in creative work",
    mainImage: null,
    categories: ["Art", "Philosophy"],
    author: "Knead Team",
  },
  {
    _id: "eli-mcmullen",
    title: "Eli McMullen",
    slug: { current: "eli-mcmullen" },
    publishedAt: "2024-01-13T10:00:00Z",
    excerpt: "A conversation with artist Eli McMullen about his creative process",
    mainImage: null,
    categories: ["Art", "Interview"],
    author: "Knead Team",
  },
  {
    _id: "tarantula",
    title: "Tarantula",
    slug: { current: "tarantula" },
    publishedAt: "2024-01-12T10:00:00Z",
    excerpt: "An in-depth look at the Tarantula project and its cultural impact",
    mainImage: null,
    categories: ["Culture", "Art"],
    author: "Knead Team",
  },
  {
    _id: "ben-rubin-towns",
    title: "Ben Rubin of Towns",
    slug: { current: "ben-rubin-towns" },
    publishedAt: "2024-01-11T10:00:00Z",
    excerpt: "Ben Rubin discusses the future of digital communities with Towns",
    mainImage: null,
    categories: ["Tech", "Interview"],
    author: "Knead Team",
  },
]

const fallbackBottomThreeStories = [
  {
    _id: "dylan-abruscato-crypto-game",
    title: "Dylan Abruscato Talks Crypto: The Game Season 3- Resurrection Island",
    slug: { current: "dylan-abruscato-crypto-game" },
    publishedAt: "2024-01-10T10:00:00Z",
    excerpt: "Dylan Abruscato discusses the latest season of Crypto: The Game and its innovative gameplay mechanics",
    mainImage: null,
    categories: ["Gaming", "Crypto"],
    author: "Knead Team",
  },
  {
    _id: "clay-hoss-helens",
    title: "Clay Hoss of Helen's",
    slug: { current: "clay-hoss-helens" },
    publishedAt: "2024-01-09T10:00:00Z",
    excerpt: "A conversation with Clay Hoss about Helen's and the intersection of art and community",
    mainImage: null,
    categories: ["Art", "Interview"],
    author: "Knead Team",
  },
  {
    _id: "decentraland-music-festival",
    title: "Decentraland Music Festival",
    slug: { current: "decentraland-music-festival" },
    publishedAt: "2024-01-08T10:00:00Z",
    excerpt: "A comprehensive look at the Decentraland Music Festival and its impact on virtual entertainment",
    mainImage: null,
    categories: ["Music", "Virtual"],
    author: "Knead Team",
  },
]

// Helper function to sort posts by the specified order and fill missing ones with fallback
function sortAndFillPosts(posts: SanityDocument[], titleOrder: string[], fallbackPosts: any[]) {
  const sortedPosts: any[] = []

  titleOrder.forEach((title, index) => {
    const post = posts.find((p) => p.title === title)
    if (post) {
      sortedPosts.push(post)
    } else {
      // Use fallback post if not found in Sanity
      const fallbackPost = fallbackPosts.find((fp) => fp.title === title)
      if (fallbackPost) {
        sortedPosts.push(fallbackPost)
      }
    }
  })

  return sortedPosts
}

export default async function Home() {
  let topFivePosts: SanityDocument[] = []
  let bottomThreePosts: SanityDocument[] = []

  try {
    // Try to fetch from Sanity
    if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
      // Fetch top 5 posts
      const topFiveFromSanity = await client.fetch<SanityDocument[]>(SPECIFIC_POSTS_QUERY, {
        titles: topFiveStoryTitles,
      })

      // Fetch bottom 3 posts
      const bottomThreeFromSanity = await client.fetch<SanityDocument[]>(SPECIFIC_POSTS_QUERY, {
        titles: bottomThreeStoryTitles,
      })

      // Sort them and fill missing ones with fallback data
      topFivePosts = sortAndFillPosts(topFiveFromSanity, topFiveStoryTitles, fallbackTopFiveStories)
      bottomThreePosts = sortAndFillPosts(bottomThreeFromSanity, bottomThreeStoryTitles, fallbackBottomThreeStories)
    }
  } catch (error) {
    console.error("Error fetching posts from Sanity:", error)
  }

  // Use fallback data if no posts found
  const heroPosts = topFivePosts.length > 0 ? topFivePosts : fallbackTopFiveStories
  const bottomPosts = bottomThreePosts.length > 0 ? bottomThreePosts : fallbackBottomThreeStories

  // Ensure we always have exactly 3 bottom posts
  const finalBottomPosts = bottomPosts.length >= 3 ? bottomPosts.slice(0, 3) : fallbackBottomThreeStories

  return (
    <main className="min-h-screen">
      <Header />

      <ScrollFadeWrapper>
        {/* Hero Section - Top 5 stories with scroll fade */}
        <section className="full-bleed">
          {heroPosts.map((post, index) => (
            <div key={`${post._id}-${index}`} data-scroll-index={index}>
              <PostCardFullBleed post={post} />
            </div>
          ))}
        </section>

        {/* Spacer */}
        <div className="h-8"></div>

        {/* Bottom Three Stories Section - with scroll fade */}
        <section className="container-magazine pt-32 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {finalBottomPosts.map((post, index) => (
              <div key={post._id} data-scroll-index={index + 5}>
                <PostCard post={post} />
              </div>
            ))}
          </div>

          <div className="text-center mb-16">
            <Link
              href="/archive"
              className="inline-block px-8 py-4 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-georgia-pro"
            >
              Visit The Archive
            </Link>
          </div>
        </section>
      </ScrollFadeWrapper>
    </main>
  )
}
