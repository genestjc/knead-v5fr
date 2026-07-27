"use client"

import type React from "react"

import { useEffect, useState } from "react"

interface ScrollFadeWrapperProps {
  children: React.ReactNode
}

// Fraction of the remaining distance the effects travel each frame. Lower values
// make the cards lag further behind the real scroll position and take longer to
// settle, which is what reads as weight.
const SCROLL_DAMPING = 0.075

export function ScrollFadeWrapper({ children }: ScrollFadeWrapperProps) {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    // Trail the real scroll position instead of matching it, so the stories carry
    // momentum into and out of a scroll rather than snapping to it.
    let damped = window.scrollY
    let frame: number | null = null

    setScrollY(damped)

    const tick = () => {
      const target = window.scrollY
      damped += (target - damped) * SCROLL_DAMPING

      // Once we're within a sub-pixel of the target, land on it and let the loop
      // idle until the next scroll rather than animating forever.
      if (Math.abs(target - damped) < 0.1) {
        setScrollY(target)
        frame = null
        return
      }

      setScrollY(damped)
      frame = requestAnimationFrame(tick)
    }

    const handleScroll = () => {
      if (frame === null) frame = requestAnimationFrame(tick)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (frame !== null) cancelAnimationFrame(frame)
    }
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
    // Slow, wide drift - a heavier body swings further and less often
    const floatSpeed = 0.06 + index * 0.011
    const floatAmount = 8 + index * 1.6

    // Add a secondary wave for more complex breathing motion
    const secondaryFloat = Math.sin(scrollY * floatSpeed * 0.007) * (floatAmount * 0.3)

    // Primary sine wave motion
    const primaryFloat = Math.sin(scrollY * floatSpeed * 0.01) * floatAmount

    // Combine for richer movement
    const combinedFloat = primaryFloat + secondaryFloat

    // Add subtle scale breathing effect
    const scaleAmount = 1 + Math.sin(scrollY * floatSpeed * 0.008) * 0.01 // Very subtle scale breathing

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
      // The damped scroll value already smooths the motion, so a transform
      // transition on top of it would only blur the settle.
      ;(element as HTMLElement).style.transition = "opacity 0.4s ease-out"
      ;(element as HTMLElement).style.transformOrigin = "center center" // Ensure scale happens from center

      // Skip opacity changes for Blvck Svm - let CSS animation handle it
      if (index === 0) return

      const opacity = getScrollOpacity(index)
      ;(element as HTMLElement).style.opacity = opacity.toString()
    })
  }, [scrollY])

  return <>{children}</>
}
