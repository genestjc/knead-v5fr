"use client"

import type React from "react"

import { useEffect, useState } from "react"

interface ScrollFadeWrapperProps {
  children: React.ReactNode
}

export function ScrollFadeWrapper({ children }: ScrollFadeWrapperProps) {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Calculate opacity based on scroll position
  const getScrollOpacity = (index: number) => {
    const baseOpacity = 0.15 // Starting opacity
    const maxOpacity = 1.0 // Full opacity

    // Skip scroll handling for Blvck Svm (index 0) - it has its own CSS animation
    if (index === 0) {
      return maxOpacity // Let CSS handle the fade-in
    }

    // Minimal fade for Constant Practice (index 1) - keep it mostly visible
    if (index === 1) {
      const minOpacity = 0.7 // Much higher starting opacity
      const scrollTrigger = 200
      const scrollRange = 300
      const progress = Math.min(Math.max((scrollY - scrollTrigger) / scrollRange, 0), 1)
      return minOpacity + (maxOpacity - minOpacity) * progress
    }

    // Regular scroll-based timing for other stories
    const scrollTrigger = index * 200 // Stagger scroll triggers
    const scrollRange = 400 // Distance for fade

    const progress = Math.min(Math.max((scrollY - scrollTrigger) / scrollRange, 0), 1)
    return baseOpacity + (maxOpacity - baseOpacity) * progress
  }

  // Enhanced floating transform with more breathing feeling
  const getFloatTransform = (index: number) => {
    // Enhanced floating speeds and amounts for more breathing effect
    const floatSpeed = 0.08 + index * 0.015 // Slightly slower for more graceful movement
    const floatAmount = 6 + index * 1.2 // Increased float distance for more presence

    // Add a secondary wave for more complex breathing motion
    const secondaryFloat = Math.sin(scrollY * floatSpeed * 0.007) * (floatAmount * 0.3)

    // Primary sine wave motion
    const primaryFloat = Math.sin(scrollY * floatSpeed * 0.01) * floatAmount

    // Combine for richer movement
    const combinedFloat = primaryFloat + secondaryFloat

    // Add subtle scale breathing effect
    const scaleAmount = 1 + Math.sin(scrollY * floatSpeed * 0.008) * 0.008 // Very subtle scale breathing

    return `translateY(${combinedFloat}px) scale(${scaleAmount})`
  }

  useEffect(() => {
    // Apply scroll-based opacity and enhanced floating to elements with data-scroll-index
    const elements = document.querySelectorAll("[data-scroll-index]")
    elements.forEach((element) => {
      const index = Number.parseInt(element.getAttribute("data-scroll-index") || "0")

      // Apply enhanced floating to all stories
      const floatTransform = getFloatTransform(index)
      ;(element as HTMLElement).style.transform = floatTransform
      ;(element as HTMLElement).style.transition = "opacity 0.4s ease-out, transform 0.15s ease-out" // Slightly slower transform for smoother breathing
      ;(element as HTMLElement).style.transformOrigin = "center center" // Ensure scale happens from center

      // Skip opacity changes for Blvck Svm - let CSS animation handle it
      if (index === 0) return

      const opacity = getScrollOpacity(index)
      ;(element as HTMLElement).style.opacity = opacity.toString()
    })
  }, [scrollY])

  return <>{children}</>
}
