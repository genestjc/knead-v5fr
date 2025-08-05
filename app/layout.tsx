import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/toaster";
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/thirdweb-client";

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
        <ThirdwebProvider client={client}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <WalletProvider>
              <MembershipProvider>
                {children}
                <Footer />
                <Toaster />
              </MembershipProvider>
            </WalletProvider>
          </ThemeProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
