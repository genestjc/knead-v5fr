import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { OnboardingHandler } from "@/components/onboarding-handler";

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Knead",
  description: "Nourishment for the creative spirit.",
  openGraph: {
    title: "Knead",
    description: "Nourishment for the creative spirit.",
    type: "website",
    url: "https://kneadmag.com",
    siteName: "Knead",
  },
  twitter: {
    card: "summary_large_image",
    title: "Knead",
    description: "Nourishment for the creative spirit.",
  },
  generator: 'v0.dev'
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
