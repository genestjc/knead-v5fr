"use client"

import Link from "next/link"
import { ThirdWebConnectButton } from "./thirdweb-connect-button"
import { Menu } from "./menu"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
            <div className="md:hidden">
              <Link className="flex items-center space-x-2" href="/">
                <span className="font-bold" style={{ fontFamily: "Adonis, 'Georgia Pro', serif" }}>
                  Knead
                </span>
              </Link>
            </div>
          </div>
          <nav className="flex items-center space-x-4">
            <ThirdWebConnectButton />
            <Menu />
          </nav>
        </div>
      </div>
    </header>
  )
}
