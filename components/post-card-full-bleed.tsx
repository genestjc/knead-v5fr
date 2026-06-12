import Link from "next/link"
import Image from "next/image"
import { urlFor } from "@/lib/sanity"

export function PostCardFullBleed({ post }: { post: any }) {
  // Handle both Sanity and mock data structures
  let imageUrl = "/magazine-article.png" // Default fallback

  // Special case for Constant Practice - use the new image
  if (post.title?.toLowerCase().includes("constant practice")) {
    imageUrl = "constant-practice-photo.jpg"
  }
  // Check if this is Sanity data with mainImage asset (for Blvck Svm and others)
  else if (post.mainImage && typeof post.mainImage === "object" && post.mainImage.asset) {
    try {
      imageUrl = urlFor(post.mainImage).width(1920).height(1080).auto("format").fit("crop").crop("focalpoint").url()
    } catch (error) {
      console.error("Error generating Sanity image URL:", error)
      imageUrl = "/magazine-article.png"
    }
  }
  // Check if this is mock data with a direct image URL
  else if (post.mainImage && typeof post.mainImage === "string") {
    imageUrl = post.mainImage
  }

  // Handle slug for both Sanity and mock data
  const slug = post.slug?.current || post.slug

  // Determine mobile positioning based on post title
  let mobileObjectPosition = "object-center"

  if (post.title?.toLowerCase().includes("blvck svm")) {
    mobileObjectPosition = "object-[30%_center]" // Better centering for Blvck Svm on mobile
  } else if (post.title?.toLowerCase().includes("mcmullen") || post.title?.toLowerCase().includes("eli")) {
    mobileObjectPosition = "object-[40%_center]" // Slightly left of center
  } else if (post.title?.toLowerCase().includes("tarantula")) {
    mobileObjectPosition = "object-[65%_center]" // Right positioning
  } else if (post.title?.toLowerCase().includes("ben rubin")) {
    mobileObjectPosition = "object-[45%_center]" // Slight left positioning
  } else if (post.title?.toLowerCase().includes("constant practice")) {
    mobileObjectPosition = "object-center" // Center positioning for the new photo
  }

  return (
    <article className="relative w-full h-screen min-h-[600px] overflow-hidden group">
      <div className="absolute inset-0 z-0">
        <Image
          src={imageUrl || "/placeholder.svg"}
          alt={post.title || "Post image"}
          fill
          className={`object-cover md:object-center ${mobileObjectPosition}`}
          priority
        />
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>
      </div>

      <Link href={`/posts/${slug}`} className="block absolute inset-0 z-10">
        <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 max-w-4xl text-left">
          <h1 className="font-adonis text-3xl md:text-4xl lg:text-5xl xl:text-6xl opacity-70 transition-opacity duration-300 text-white group-hover:opacity-100">
            {post.title}
          </h1>
        </div>
      </Link>
    </article>
  )
}
