import { getClient } from "./sanity"
import { getPosts } from "./cms"
import type { Post } from "./types"
import { posts as mockPosts } from "./mock-data"

// Get a post by ID
export async function getPostById(id: string): Promise<Post> {
  // Use mock data if no Sanity project ID is set
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    const post = mockPosts.find((post) => post.id === id)
    if (!post) {
      throw new Error(`Post with ID ${id} not found`)
    }
    return post
  }

  try {
    const client = getClient(true) // Use preview client to get draft content

    const query = `*[_type == "post" && _id == $id][0] {
      _id,
      title,
      slug,
      excerpt,
      content,
      mainImage,
      publishedAt,
      isPremium,
      "author": author->
    }`

    const post = await client.fetch(query, { id })

    if (!post) {
      throw new Error(`Post with ID ${id} not found`)
    }

    // Get all posts to transform the post
    const posts = await getPosts(true)
    return posts.find((p) => p.id === id) as Post
  } catch (error) {
    console.error("Error fetching post from Sanity:", error)
    console.log("Falling back to mock data")

    const post = mockPosts.find((post) => post.id === id)
    if (!post) {
      throw new Error(`Post with ID ${id} not found`)
    }
    return post
  }
}

// Update a post
export async function updatePost(post: Post): Promise<Post> {
  // Use mock data if no Sanity project ID is set
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    console.log("Mock updating post:", post.id)
    return post
  }

  try {
    const client = getClient(true)

    // Convert our app's post format back to Sanity format
    const sanityPost = {
      title: post.title,
      slug: {
        _type: "slug",
        current: post.slug,
      },
      excerpt: post.excerpt,
      isPremium: post.isPremium || false,
    }

    // Update the post in Sanity
    await client.patch(post.id).set(sanityPost).commit()

    // Return the updated post
    return getPostById(post.id)
  } catch (error) {
    console.error("Error updating post in Sanity:", error)
    console.log("Falling back to mock update")
    return post
  }
}

// Create a new post
export async function createPost(post: Partial<Post>): Promise<Post> {
  // Use mock data if no Sanity project ID is set
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    const newPost: Post = {
      id: `new-${Date.now()}`,
      title: post.title || "New Post",
      slug: post.slug || post.title?.toLowerCase().replace(/\s+/g, "-") || `post-${Date.now()}`,
      excerpt: post.excerpt || "",
      content: post.content || "New post content",
      publishedAt: new Date().toISOString(),
      author: mockPosts[0].author,
      isPremium: post.isPremium || false,
      coverImage: post.coverImage,
    }

    console.log("Mock creating post:", newPost.id)
    return newPost
  }

  try {
    const client = getClient(true)

    // Get the first author (in a real app, you'd use the current user)
    const query = `*[_type == "author"][0]._id`
    const authorId = await client.fetch(query)

    // Create a slug from the title if not provided
    const slug = post.slug || post.title?.toLowerCase().replace(/\s+/g, "-") || `post-${Date.now()}`

    // Create the post in Sanity
    const result = await client.create({
      _type: "post",
      title: post.title || "New Post",
      slug: {
        _type: "slug",
        current: slug,
      },
      excerpt: post.excerpt || "",
      content: [
        {
          _type: "block",
          style: "normal",
          children: [
            {
              _type: "span",
              text: post.content || "New post content",
            },
          ],
        },
      ],
      publishedAt: new Date().toISOString(),
      author: {
        _type: "reference",
        _ref: authorId,
      },
      isPremium: post.isPremium || false,
    })

    // Return the new post
    return getPostById(result._id)
  } catch (error) {
    console.error("Error creating post in Sanity:", error)
    console.log("Falling back to mock creation")

    const newPost: Post = {
      id: `new-${Date.now()}`,
      title: post.title || "New Post",
      slug: post.slug || post.title?.toLowerCase().replace(/\s+/g, "-") || `post-${Date.now()}`,
      excerpt: post.excerpt || "",
      content: post.content || "New post content",
      publishedAt: new Date().toISOString(),
      author: mockPosts[0].author,
      isPremium: post.isPremium || false,
      coverImage: post.coverImage,
    }

    return newPost
  }
}

// Delete a post
export async function deletePost(id: string): Promise<void> {
  // Use mock data if no Sanity project ID is set
  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    console.log("Mock deleting post:", id)
    return
  }

  try {
    const client = getClient(true)
    await client.delete(id)
  } catch (error) {
    console.error("Error deleting post from Sanity:", error)
    console.log("Mock deleting post:", id)
  }
}
