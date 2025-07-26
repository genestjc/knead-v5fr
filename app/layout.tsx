import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { WalletProvider } from "@/components/wallet-provider"
import { MembershipProvider } from "@/components/membership-provider"
import { OnboardFreemium } from "@/components/onboard-freemium"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Knead",
  description: "A digital magazine exploring food, culture, and community through thoughtful storytelling.",
  openGraph: {
    title: "Knead",
    description: "A digital magazine exploring food, culture, and community through thoughtful storytelling.",
    type: "website",
    url: "https://kneadmag.com",
    siteName: "Knead",
  },
  twitter: {
    card: "summary_large_image",
    title: "Knead",
    description: "A digital magazine exploring food, culture, and community through thoughtful storytelling.",
  },
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/gne1bgd.css" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <WalletProvider>
            <MembershipProvider>
              {children}
              <Footer />
              <OnboardFreemium />
              <Toaster />
            </MembershipProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
