import { createClient } from "next-sanity"
import imageUrlBuilder from "@sanity/image-url"

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
export const apiVersion = "2023-05-03" // Use proper date format instead of version number

// Create a read-only client for public data fetching
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // Use CDN for faster reads
  token: process.env.SANITY_API_READ_TOKEN,
  ignoreBrowserTokenWarning: true,
})

// Create a write client for admin operations
export const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // Don't use CDN for writes
  token: process.env.SANITY_API_WRITE_TOKEN,
  ignoreBrowserTokenWarning: true,
})

// Helper function to get the appropriate client
export const getClient = (preview = false) => {
  if (preview) {
    return createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      token: process.env.SANITY_API_WRITE_TOKEN, // Use write token for preview
      ignoreBrowserTokenWarning: true,
    })
  }

  return client // Use read client for normal operations
}

// Set up the image URL builder
const builder = imageUrlBuilder(client)

// Helper function to get image URLs
export const urlFor = (source: any) => {
  return builder.image(source)
}

// v6-safe helper for draft document IDs (replaces the removed getDraftId import)
export const getDraftId = (id: string) => (id.startsWith("drafts.") ? id : `drafts.${id}`)
