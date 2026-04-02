import { createClient } from "next-sanity"
import imageUrlBuilder from "@sanity/image-url"

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
export const apiVersion = "2023-05-03"

// Create a standard client for fetching data
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
})

// Helper function to get the client
export const getClient = (preview = false) => client

// Set up the image URL builder
const builder = imageUrlBuilder(client)

// Helper function to get image URLs
export const urlFor = (source: any) => {
  return builder.image(source)
}

// v6-safe helper for draft document IDs (replaces the removed getDraftId import)
export const getDraftId = (id: string) => (id.startsWith("drafts.") ? id : `drafts.${id}`)
