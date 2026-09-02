import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/constants"

/**
 * robots.txt, served at /robots.txt by Next's file convention.
 *
 * AI crawlers are deliberately *not* blocked. Being retrieved by them is the
 * point — Knead wants to be the source an answer engine cites. What protects
 * premium content is the entitlement check, not an honour-system directive in
 * this file.
 *
 * The disallow list is only routes that would waste crawl budget or expose
 * account surfaces: nothing here is a security control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/studio",
          "/unsubscribe",
          "/cancel-membership",
          "/membership/success",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
