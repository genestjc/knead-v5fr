"use client"

import { useRouter } from "next/navigation"

// History-aware "back" link for article pages: returns readers to the page
// they came from (archive, category, chat, etc.) instead of always sending
// them to the homepage. Falls back to the homepage when the reader landed on
// the article directly (external link, new tab, typed URL).
export function BackToStoriesLink() {
  const router = useRouter()

  const handleClick = () => {
    const cameFromThisSite =
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin)

    if (cameFromThisSite) {
      router.back()
    } else {
      router.push("/")
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center font-georgia-pro text-gray-600 hover:text-gray-900 transition-colors group"
    >
      <svg className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to all stories
    </button>
  )
}
