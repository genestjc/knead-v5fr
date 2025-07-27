/**
 * This configuration is used for the Sanity Studio
 */

import { defineConfig } from "sanity"
import { deskTool } from "sanity/desk"
import { visionTool } from "@sanity/vision"

// Import schema types
import { schemaTypes } from "./sanity/schemas"
import { structure } from "./sanity/desk-structure"

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "cs0gtnjr"
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production"

export default defineConfig({
  name: "default",
  title: "Knead Blog",

  projectId,
  dataset,

  plugins: [
    deskTool({
      structure,
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    // Actions are configurable by document type
    actions: (prev) => {
      // Keep all default actions
      return prev
    },
  },

  basePath: "/studio",

  // Add CORS settings for production
  cors: {
    credentials: true,
    origin: [
      "http://localhost:3000",
      "https://www.kneadmag.com",
      "https://kneadmag.com",
      "https://knead-v5fr.vercel.app",
    ],
  },

  // Add API version
  apiVersion: "2023-05-03",

  // Studio authentication
  auth: {
    redirectOnSingle: false,
    providers: [],
  },

  // Use write token for studio operations
  token: process.env.SANITY_API_WRITE_TOKEN,
})
