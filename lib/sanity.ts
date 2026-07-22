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
  useCdn: true,
})

// Helper function to get the client
export const getClient = (preview = false) => client

// Set up the image URL builder
const builder = imageUrlBuilder(client)

// Helper function to get image URLs
export const urlFor = (source: any) => {
  return builder.image(source)
}

// Helper to resolve a Sanity file asset (e.g. audio uploads) to its CDN URL.
// Works with raw asset references ("file-<id>-<ext>") so queries don't need to dereference.
export const fileUrlFor = (source: any): string | null => {
  if (source?.asset?.url) return source.asset.url
  const ref = source?.asset?._ref || source?._ref
  if (typeof ref !== "string") return null
  const [type, id, extension] = ref.split("-")
  if (type !== "file" || !id || !extension) return null
  return `https://cdn.sanity.io/files/${projectId}/${dataset}/${id}.${extension}`
}

// v6-safe helper for draft document IDs (replaces the removed getDraftId import)
export const getDraftId = (id: string) => (id.startsWith("drafts.") ? id : `drafts.${id}`)
