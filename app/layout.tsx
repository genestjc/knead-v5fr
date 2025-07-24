import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/toaster";
import { MembershipProvider } from "@/components/membership-provider";
import { OnboardFreemium } from "@/components/onboard-freemium"; // <-- Add this import

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Knead Magazine",
  description:
    "A digital magazine exploring culture, creativity, and community",
  generator: "v0.dev",
};

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WalletProvider>
            <MembershipProvider>
              <OnboardFreemium /> {/* <-- Add this line */}
              {children}
              <Footer />
              <Toaster />
            </MembershipProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
