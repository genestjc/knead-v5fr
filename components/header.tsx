"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu } from "./menu"
import { ThirdWebConnectButton } from "./thirdweb-connect-button"
import { useActiveAccount } from "thirdweb/react"

export function Header() {
  const [scrollY, setScrollY] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const account = useActiveAccount()

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
    document.body.style.overflow = isMenuOpen ? "auto" : "hidden"
  }

  // Calculate header opacity and transform based on scroll
  const getHeaderOpacity = () => {
    const fadeStart = 100
    const fadeEnd = 300
    if (scrollY <= fadeStart) return 1
    if (scrollY >= fadeEnd) return 0.1
    return 1 - ((scrollY - fadeStart) / (fadeEnd - fadeStart)) * 0.9
  }

  // Calculate logo transform - shrink "Knead" to "K" as we scroll
  const getLogoTransform = () => {
    const transformStart = 50
    const transformEnd = 200
    if (scrollY <= transformStart) return { scale: 1, showFull: true }
    if (scrollY >= transformEnd) return { scale: 0.7, showFull: false }

    const progress = (scrollY - transformStart) / (transformEnd - transformStart)
    return {
      scale: 1 - progress * 0.3,
      showFull: progress < 0.5,
    }
  }

  const headerOpacity = getHeaderOpacity()
  const logoTransform = getLogoTransform()
  const isScrolled = scrollY > 30

  return (
    <>
      <header
        className="header-container sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
        style={{
          opacity: headerOpacity,
          transform: `translateY(${scrollY > 400 ? -100 : 0}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <Link className="mr-6 flex items-center space-x-2" href="/">
              <span className="hidden font-bold sm:inline-block" style={{ fontFamily: "Adonis, 'Georgia Pro', serif" }}>
                Knead
              </span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Mobile logo */}
              <Link className="flex items-center space-x-2 md:hidden" href="/">
                <span className="font-bold" style={{ fontFamily: "Adonis, 'Georgia Pro', serif" }}>
                  Knead
                </span>
              </Link>
            </div>

            <nav className="flex items-center space-x-4">
              {account ? (
                <span className="font-bold" style={{ fontFamily: "Adonis, 'Georgia Pro', serif" }}>
                  WalletSummary
                </span>
              ) : (
                <ThirdWebConnectButton />
              )}
              <Menu
                isOpen={isMenuOpen}
                onClose={() => {
                  setIsMenuOpen(false)
                  document.body.style.overflow = "auto"
                }}
              />
            </nav>
          </div>
        </div>
      </header>

      <div className="h-24"></div>
    </>
  )
}
