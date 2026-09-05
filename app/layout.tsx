import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { OnboardingHandler } from "@/components/onboarding-handler";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";
import { siteSchema, jsonLdScript } from "@/lib/structured-data";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    // Every page that doesn't set its own title still says what Knead is.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // `resizes-content` shrinks the *layout* viewport when the on-screen keyboard
  // opens (Chromium 108+), so `position: fixed` UI — like Demeter's chat panel —
  // stays above the keyboard instead of being covered. This is what fixes the
  // hidden chat input in Instagram's Android in-app browser. iOS ignores it and
  // is handled by the VisualViewport logic in DemeterBubble.
  interactiveWidget: "resizes-content",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/gne1bgd.css" />
        <link rel="icon" href="/faviconk.jpg" type="image/jpeg" />
        <meta name="base:app_id" content="69d7d561ec96f8d98e3ef36b" />
        {/* Identity, on every page. An engine should never have to infer what
            Knead is from whichever article it happened to crawl. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(siteSchema()) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <OnboardingHandler />
          {children}
        </Providers>
      </body>
    </html>
  );
}
