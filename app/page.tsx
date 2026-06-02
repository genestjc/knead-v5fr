import { Header } from "@/components/header"
import { PostCardFullBleed } from "@/components/post-card-full-bleed"
import { client } from "../sanity/client"
import type { SanityDocument } from "next-sanity"
import { ScrollFadeWrapper } from "@/components/scroll-fade-wrapper"
import { HomepageEvents } from "@/components/homepage-events"

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

  try {
    if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
      const topFiveFromSanity = await client.fetch<SanityDocument[]>(SPECIFIC_POSTS_QUERY, {
        titles: topFiveStoryTitles,
      })
      topFivePosts = sortAndFillPosts(topFiveFromSanity, topFiveStoryTitles, fallbackTopFiveStories)
    }
  } catch (error) {
    console.error("Error fetching posts from Sanity:", error)
  }

  const heroPosts = topFivePosts.length > 0 ? topFivePosts : fallbackTopFiveStories

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

        {/* Chat Events Section */}
        <HomepageEvents />
      </ScrollFadeWrapper>
    </main>
  )
}
