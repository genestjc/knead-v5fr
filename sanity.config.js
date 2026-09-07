/**
 * This configuration is used for the Sanity Studio
 */

import { defineConfig } from "sanity"
import { deskTool } from "sanity/desk"
import { visionTool } from "@sanity/vision"

// Import schema types
import { schemaTypes } from "./sanity/schemas"
import { structure, defaultDocumentNode } from "./sanity/desk-structure"

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
      // Adds the "AEO check" tab to post documents.
      defaultDocumentNode,
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
})
