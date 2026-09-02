import type { MetadataRoute } from "next"
import { client } from "@/sanity/client"
import { SITE_URL } from "@/lib/constants"

// Match the post page's ISR window so a newly published story shows up in the
// sitemap on the same cadence it becomes fetchable.
export const revalidate = 60

const SITEMAP_QUERY = `{
  "posts": *[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    "slug": slug.current,
    publishedAt,
    _updatedAt
  },
  "authors": *[_type == "author" && defined(_id)] {
    _id,
    _updatedAt
  }
}`

interface SitemapData {
  posts: Array<{ slug: string; publishedAt?: string; _updatedAt?: string }>
  // Author pages are routed by Sanity _id (app/authors/[id]), not by slug —
  // the schema has a slug field, but the route ignores it.
  authors: Array<{ _id: string; _updatedAt?: string }>
}

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "", priority: 1.0, changeFrequency: "daily" },
  { path: "/archive", priority: 0.8, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/join", priority: 0.5, changeFrequency: "monthly" },
  { path: "/open-source", priority: 0.5, changeFrequency: "weekly" },
  { path: "/privacy", priority: 0.1, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.1, changeFrequency: "yearly" },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  let data: SitemapData
  try {
    data = await client.fetch<SitemapData>(SITEMAP_QUERY)
  } catch (error) {
    // A CMS outage should degrade the sitemap to the static routes, not fail
    // the build or serve a 500 to a crawler.
    console.error("[sitemap] Sanity fetch failed, serving static routes only:", error)
    return staticEntries
  }

  const postEntries: MetadataRoute.Sitemap = (data?.posts ?? []).map((post) => ({
    url: `${SITE_URL}/posts/${post.slug}`,
    lastModified: new Date(post._updatedAt || post.publishedAt || Date.now()),
    changeFrequency: "monthly",
    priority: 0.9,
  }))

  const authorEntries: MetadataRoute.Sitemap = (data?.authors ?? []).map((author) => ({
    url: `${SITE_URL}/authors/${author._id}`,
    lastModified: new Date(author._updatedAt || Date.now()),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticEntries, ...postEntries, ...authorEntries]
}
