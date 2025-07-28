import { createClient } from "@sanity/client"

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2023-05-03"

// Read-only client for public content
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  token: process.env.SANITY_API_READ_TOKEN,
})

// Write client for studio and preview mode
export const sanityWriteClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

// Function to get the appropriate client based on preview mode
export function getClient(preview?: boolean) {
  return preview ? sanityWriteClient : sanityClient
}

// Helper function for image URLs
export function urlFor(source: any) {
  return sanityClient.image(source)
}

// Export default client
export default sanityClient
