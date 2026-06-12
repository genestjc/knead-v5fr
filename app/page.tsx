import { Header } from "@/components/header"
import { PostCardFullBleed } from "@/components/post-card-full-bleed"
import { client } from "../sanity/client"
import type { SanityDocument } from "next-sanity"
import { ScrollFadeWrapper } from "@/components/scroll-fade-wrapper"
import { HomepageEvents } from "@/components/homepage-events"

export const revalidate = 60

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

export default async function Home() {
  let heroPosts: SanityDocument[] = []

  try {
    heroPosts = await client.fetch<SanityDocument[]>(RECENT_POSTS_QUERY)
  } catch (error) {
    console.error("Error fetching posts from Sanity:", error)
  }

  return (
    <main className="min-h-screen">
      <Header />

      <ScrollFadeWrapper>
        <section className="full-bleed">
          {heroPosts.map((post, index) => (
            <div key={`${post._id}-${index}`} data-scroll-index={index}>
              <PostCardFullBleed post={post} />
            </div>
          ))}
        </section>

        <div className="h-8"></div>

        <HomepageEvents />
      </ScrollFadeWrapper>
    </main>
  )
}
