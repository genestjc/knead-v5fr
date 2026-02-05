import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://use.typekit.net/gne1bgd.css"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          {/* ✅ Footer removed - now handled by template.tsx */}
        </Providers>
      </body>
    </html>
  );
}
