import Link from "next/link"
import { urlFor } from "@/lib/sanity"
import { formatDate } from "@/lib/utils"

interface PostCardProps {
  post: {
    _id: string
    title: string
    slug: { current: string }
    excerpt?: string
    mainImage?: any
    publishedAt: string
    author?: {
      name: string
    }
    categories?: Array<{
      title: string
    }>
    isPremium?: boolean
  }
}

export function PostCard({ post }: PostCardProps) {
  const imageUrl = post.mainImage
    ? urlFor(post.mainImage).width(800).height(600).auto("format").fit("crop").crop("focalpoint").url()
    : "/placeholder.svg?height=400&width=600"

  return (
    <article className="post-card-hover group">
      <Link href={`/posts/${post.slug.current}`} className="block">
        <div className="aspect-[4/3] overflow-hidden rounded-lg mb-4">
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        <div className="space-y-2">
          {post.isPremium && <span className="premium-badge">Members Only</span>}

          <h2 className="font-adonis text-xl md:text-2xl leading-tight group-hover:text-gray-600 transition-colors">
            {post.title}
          </h2>

          {post.excerpt && <p className="font-georgia-pro text-gray-600 text-sm leading-relaxed">{post.excerpt}</p>}

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
            <span className="font-georgia-pro">{post.author?.name && `By ${post.author.name}`}</span>
            <time className="font-georgia-pro">{formatDate(post.publishedAt)}</time>
          </div>

          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {post.categories.map((category, index) => (
                <span key={index} className="font-georgia-pro text-xs text-gray-400 uppercase tracking-wide">
                  {category.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
