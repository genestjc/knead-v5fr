"use client"

import Link from "next/link"
import Image from "next/image"
import { formatDate } from "@/lib/utils"
import { urlFor } from "@/lib/sanity"
import { useEffect, useState } from "react"

interface Post {
  slug: string | { current: string }
  title: string
  publishedAt: string
  mainImage?: any
  excerpt?: string
}

interface ArchiveGridProps {
  posts: Post[]
}

export function ArchiveGrid({ posts }: ArchiveGridProps) {
  const [visiblePosts, setVisiblePosts] = useState<Set<number>>(new Set())

  useEffect(() => {
    console.log("🔍 TITLE DEBUG - Archive Grid received posts:")
    posts.forEach((post, index) => {
      console.log(`🔍 Post ${index}: "${post.title}"`)
    })
  }, [posts])

  const cleanTitle = (title: string) => {
    console.log("🔍 TITLE DEBUG - cleanTitle input:", title)

    // Remove duplicate text and timestamps
    let cleaned = title
      .replace(/Knead \d+\/\d+\/\d+, \d+:\d+ (AM|PM)/, "") // Remove timestamp
      .replace(/(.+?)\1+/, "$1") // Remove duplicated text
      .trim()

    console.log("🔍 TITLE DEBUG - After timestamp/duplicate removal:", cleaned)

    // Simple string replacements for actual misspellings only
    const corrections = [
      { from: "Clay Hos", to: "Clay Hoss" },
      { from: "Jeremiah Moris", to: "Jeremiah Morris" },
      { from: "DJ Harison", to: "DJ Harrison" },
      { from: "Eli McMulen", to: "Eli McMullen" },
      { from: "Canabis", to: "Cannabis" },
      { from: "Nicola Formicheti", to: "Nicola Formichetti" },
      { from: "Broad Stret Bullies", to: "Broad Street Bullies" },
      { from: "Somehodlum", to: "Somehoodlum" },
      { from: "Julian Holguin of Dodles", to: "Julian Holguin of Doodles" },
      { from: "gmoney Talks 9dc + NINES Program", to: "gmoney Talks 9dcc + NINES Program" },
      {
        from: "Dylan Abruscato Talks Crypto: The Game Season 3- Resurection Island",
        to: "Dylan Abruscato Talks Crypto: The Game Season 3- Resurrection Island",
      },
      {
        from: "gmoney Talks 9dc's ITERATION-04 'Black Box' Release",
        to: "gmoney Talks 9dcc's ITERATION-04 'Black Box' Release",
      },
    ]

    const originalCleaned = cleaned

    corrections.forEach(({ from, to }) => {
      if (cleaned.includes(from)) {
        console.log(`🔧 Applying correction: ${from} → ${to}`)
        cleaned = cleaned.replace(from, to)
      }
    })

    if (originalCleaned !== cleaned) {
      console.log("✅ Title corrected from:", originalCleaned)
      console.log("✅ Title corrected to:", cleaned)
    } else {
      console.log("🔍 TITLE DEBUG - No corrections needed for:", cleaned)
    }

    return cleaned
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number.parseInt(entry.target.getAttribute("data-index") || "0")
            setVisiblePosts((prev) => new Set([...prev, index]))
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
      },
    )

    // Use a timeout to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      const postElements = document.querySelectorAll("[data-index]")
      postElements.forEach((el) => observer.observe(el))
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
    }
  }, [posts])

  const getImageUrl = (post: Post) => {
    // Check for Sanity mainImage with asset
    if (post.mainImage?.asset) {
      try {
        const url = urlFor(post.mainImage).width(600).height(400).auto("format").fit("crop").crop("focalpoint").url()
        console.log("Generated Sanity URL for", post.title, ":", url)
        return url
      } catch (error) {
        console.error("Error generating Sanity image URL for post:", post.title, error)
      }
    }

    // Check if mainImage has a direct URL
    if (post.mainImage?.asset?.url) {
      console.log("Using direct asset URL for", post.title, ":", post.mainImage.asset.url)
      return post.mainImage.asset.url
    }

    // Check if mainImage is a direct URL string
    if (typeof post.mainImage === "string" && post.mainImage.startsWith("http")) {
      console.log("Using direct string URL for", post.title, ":", post.mainImage)
      return post.mainImage
    }

    console.log("No valid image found for post:", post.title, "mainImage:", post.mainImage)
    return null
  }

  const getSlug = (post: Post) => {
    return typeof post.slug === "object" ? post.slug.current : post.slug
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {posts.map((post, index) => {
        const slug = getSlug(post)
        const isVisible = visiblePosts.has(index)
        const imageUrl = getImageUrl(post)

        // Show all posts, use placeholder if no image
        return (
          <article
            key={slug}
            className={`group transition-all duration-700 ease-out ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            data-index={index}
            style={{
              transitionDelay: `${(index % 3) * 150}ms`,
            }}
          >
            <Link href={`/posts/${slug}`} className="block">
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg">
                <Image
                  src={imageUrl || "/placeholder.svg?height=400&width=600"}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover:bg-black/40" />
                <div className="absolute inset-0 flex items-end p-6">
                  <div className="transition-colors duration-300">
                    <div className="text-sm font-georgia-pro mb-2 text-gray-200 group-hover:text-white transition-colors duration-300">
                      {formatDate(post.publishedAt)}
                    </div>
                    <h3 className="font-adonis text-xl leading-tight text-gray-100 group-hover:text-white transition-colors duration-300">
                      {cleanTitle(post.title)}
                    </h3>
                  </div>
                </div>
              </div>
            </Link>
          </article>
        )
      })}
    </div>
  )
}
