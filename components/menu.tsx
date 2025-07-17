"use client"

import Link from "next/link"
import { useEffect } from "react"

interface MenuProps {
  isOpen: boolean
  onClose: () => void
}

export function Menu({ isOpen, onClose }: MenuProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  return (
    <div className={`menu-overlay ${isOpen ? "open" : ""}`}>
      <div className="menu-header">
        <Link href="/" className="menu-logo font-adonis" onClick={onClose}>
          K
        </Link>
        <button className="menu-close" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </div>
      <nav className="menu-content">
        <Link href="/about" className="menu-link font-adonis" onClick={onClose}>
          About
        </Link>
        <Link href="/join" className="menu-link font-adonis" onClick={onClose}>
          Join
        </Link>
        <Link href="/shop" className="menu-link font-adonis" onClick={onClose}>
          Shop
        </Link>
        <Link href="/archive" className="menu-link font-adonis" onClick={onClose}>
          The Archive
        </Link>
      </nav>
    </div>
  )
}
