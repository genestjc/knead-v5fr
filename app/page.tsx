import { Header } from "@/components/header"
import { PostCardFullBleed } from "@/components/post-card-full-bleed"
import { client } from "../sanity/client"
import type { SanityDocument } from "next-sanity"
import { ScrollFadeWrapper } from "@/components/scroll-fade-wrapper"
import { HomepageEvents } from "@/components/homepage-events"

// Re-fetch from Sanity at most once a minute so new stories appear without a redeploy
export const revalidate = 60

// Five most recent stories, newest first
const RECENT_POSTS_QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc)[0...5]{
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

// Shown only if Sanity is unreachable or returns nothing
const fallbackHeroStories = [
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

export default async function Home() {
  let recentPosts: SanityDocument[] = []

  try {
    if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
      recentPosts = await client.fetch<SanityDocument[]>(RECENT_POSTS_QUERY)
    }
  } catch (error) {
    console.error("Error fetching posts from Sanity:", error)
  }

  const heroPosts = recentPosts.length > 0 ? recentPosts : fallbackHeroStories

  return (
    <main className="min-h-screen">
      <Header />

      <ScrollFadeWrapper>
        {/* Hero Section - 5 most recent stories with scroll fade */}
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
