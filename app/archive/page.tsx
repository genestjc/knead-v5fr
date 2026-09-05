import type { Metadata } from "next"
import { SITE_NAME } from "@/lib/constants"
import { Header } from "@/components/header"
import { getPosts } from "@/lib/cms"

export const metadata: Metadata = {
  title: "Archive",
  description: `Every story published by ${SITE_NAME}, an independent magazine covering art, music, food, technology, and other creative disciplines.`,
  alternates: { canonical: "/archive" },
}
import { ArchiveGrid } from "@/components/archive-grid"

// Add this to revalidate every 60 seconds (or use 0 for on-demand)
export const revalidate = 60 // seconds

export default async function ArchivePage() {
  const posts = await getPosts()

  return (
    <main>
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-adonis mb-12 text-center">The Archive</h1>

        <ArchiveGrid posts={posts} />

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No posts found in The Archive.</p>
          </div>
        )}
      </div>
    </main>
  )
}
