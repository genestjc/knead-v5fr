import { getClient, urlFor } from "./sanity"
import type { Post, Author } from "./types"
import { posts as mockPosts } from "./mock-data"

// Transform Sanity author to our app's author format
function transformAuthor(sanityAuthor: any): Author {
  if (!sanityAuthor || !sanityAuthor._id) {
    // Return a default author if none exists
    return {
      id: "default",
      name: "Anonymous",
      bio: undefined,
      avatar: undefined,
    }
  }

  return {
    id: sanityAuthor._id,
    name: sanityAuthor.name || "Anonymous",
    bio: sanityAuthor.bio || undefined,
    avatar: sanityAuthor.image ? urlFor(sanityAuthor.image).width(100).height(100).url() : undefined,
  }
}

// Transform Sanity post to our app's post format
function transformPost(sanityPost: any, author: Author): Post {
  console.log("🔍 TITLE DEBUG - Raw Sanity post title:", sanityPost.title)

  const transformedPost = {
    id: sanityPost._id,
    title: sanityPost.title,
    slug: sanityPost.slug.current,
    excerpt: sanityPost.excerpt || undefined,
    content: sanityPost.content ? transformBlockContent(sanityPost.content) : "",
    coverImage: sanityPost.mainImage ? urlFor(sanityPost.mainImage).width(1920).height(1080).url() : undefined,
    mainImage: sanityPost.mainImage, // Keep the raw mainImage data
    publishedAt: sanityPost.publishedAt,
    author,
    isPremium: sanityPost.isPremium || false,
  }

  console.log("🔍 TITLE DEBUG - After transformPost:", transformedPost.title)
  return transformedPost
}

// Transform Sanity block content to HTML (simplified version)
function transformBlockContent(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) {
    return ""
  }

  return blocks
    .map((block) => {
      if (block._type === "block") {
        const style = block.style || "normal"
        const text = block.children.map((child: any) => child.text).join("")

        switch (style) {
          case "h1":
            return `<h1>${text}</h1>`
          case "h2":
            return `<h2>${text}</h2>`
          case "h3":
            return `<h3>${text}</h3>`
          case "h4":
            return `<h4>${text}</h4>`
          case "blockquote":
            return `<blockquote>${text}</blockquote>`
          default:
            return `<p>${text}</p>`
        }
      }

      if (block._type === "image" && block.asset) {
        const imageUrl = urlFor(block).url()
        const alt = block.alt || "Blog image"
        return `<img src="${imageUrl}" alt="${alt}" />`
      }

      return ""
    })
    .join("")
}

// Get all posts
export async function getPosts(preview = false): Promise<Post[]> {
  // Use mock data if no Sanity project ID is set
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    console.log("Using mock post data (no Sanity project ID found)")
    return mockPosts
  }

  try {
    const client = getClient(preview)

    const query = `*[_type == "post" && defined(author)] | order(publishedAt desc) {
      _id,
      title,
      slug,
      excerpt,
      content,
      mainImage{
        asset->{
          _id,
          url
        },
        alt
      },
      publishedAt,
      isPremium,
      "author": author->{
        _id,
        name,
        bio,
        image
      }
    }`

    console.log("🔍 TITLE DEBUG - Fetching posts from Sanity...")
    const sanityPosts = await client.fetch(query)
    console.log(
      "🔍 TITLE DEBUG - Raw Sanity response (first 3 titles):",
      sanityPosts.slice(0, 3).map((p: any) => ({ id: p._id, title: p.title })),
    )

    const transformedPosts = sanityPosts
      .filter((post: any) => post.author && post.author._id) // Filter out posts without valid authors
      .map((post: any) => {
        const author = transformAuthor(post.author)
        return transformPost(post, author)
      })

    console.log(
      "🔍 TITLE DEBUG - After transformation (first 3 titles):",
      transformedPosts.slice(0, 3).map((p: Post) => ({ id: p.id, title: p.title })),
    )

    return transformedPosts
  } catch (error) {
    console.error("Error fetching posts from Sanity:", error)
    console.log("Falling back to mock data")
    return mockPosts
  }
}

// Get a post by slug
export async function getPostBySlug(slug: string, preview = false): Promise<Post | null> {
  // Use mock data if no Sanity project ID is set
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    console.log("Using mock post data (no Sanity project ID found)")
    const post = mockPosts.find((p) => p.slug === slug)
    return post || null
  }

  try {
    const client = getClient(preview)

    const query = `*[_type == "post" && slug.current == $slug && defined(author)][0] {
      _id,
      title,
      slug,
      excerpt,
      content,
      mainImage{
        asset->{
          _id,
          url
        },
        alt
      },
      publishedAt,
      isPremium,
      "author": author->{
        _id,
        name,
        bio,
        image
      }
    }`

    console.log("🔍 TITLE DEBUG - Fetching single post by slug:", slug)
    const sanityPost = await client.fetch(query, { slug })

    if (sanityPost) {
      console.log("🔍 TITLE DEBUG - Raw single post title:", sanityPost.title)
    }

    if (!sanityPost || !sanityPost.author || !sanityPost.author._id) {
      return null
    }

    const author = transformAuthor(sanityPost.author)
    const transformedPost = transformPost(sanityPost, author)

    console.log("🔍 TITLE DEBUG - Final single post title:", transformedPost.title)
    return transformedPost
  } catch (error) {
    console.error("Error fetching post from Sanity:", error)
    console.log("Falling back to mock data")
    const post = mockPosts.find((p) => p.slug === slug)
    return post || null
  }
}
