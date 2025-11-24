import type React from "react"
import { PortableText } from "@portabletext/react"
import Image from "next/image"
import { urlFor } from "../lib/sanity"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism"

// Minimal replacement for the removed `stegaClean` import
const stegaClean = (value: unknown) =>
  typeof value === "string" ? value.replace(/__stega__\[[\s\S]*?\]__stega__/g, "").trim() : value

// --- All your custom components (YouTube, Instagram, etc.) remain unchanged. ---
// YouTube embed component
const YouTubeEmbed = ({ value }: { value: { url: string; title?: string } }) => {
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }
  const videoId = getYouTubeId(value.url)
  if (!videoId) return <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600 font-georgia-pro">Invalid YouTube URL</p></div>
  return <div className="my-8 animate-fade-in-up animation-delay-200"><div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-lg bg-black"><iframe src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`} title={value.title || "YouTube video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 w-full h-full border-0" loading="lazy"/></div>{value.title && <p className="mt-3 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">{value.title}</p>}</div>
}
// (Your other embed components like Instagram, Twitter, PullQuote, CodeBlock, CustomImage go here, unchanged)
// ...

// Portable text components
const components = {
  types: {
    // ... your `types` like image, youtube, etc. are unchanged
  },
  marks: {
    // ... your `marks` like link, highlight, etc. are unchanged
  },
  block: {
    // **THE FIX IS HERE**
    // We add a check inside each text-based block renderer.
    // If `children` is empty or invalid, it will render an empty fragment instead of crashing.
    normal: ({ children }: { children?: React.ReactNode[] }) => {
      if (children && children.length === 1 && (children[0] === '' || (typeof children[0] === 'object' && 'props' in children[0] && !children[0].props.children))) {
        return <></>; // Render nothing for an empty paragraph
      }
      return <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700 animate-fade-in-up animation-delay-100">{children}</p>
    },
    h1: ({ children }: { children?: React.ReactNode[] }) => {
      if (!children || children.length === 0) return null;
      return <h1 className="font-adonis text-4xl md:text-5xl font-bold text-gray-900 my-8 animate-fade-in-up animation-delay-200">{children}</h1>
    },
    h2: ({ children }: { children?: React.ReactNode[] }) => {
      if (!children || children.length === 0) return null;
      return <h2 className="font-adonis text-3xl md:text-4xl font-bold text-gray-900 my-6 animate-fade-in-up animation-delay-200">{children}</h2>
    },
    h3: ({ children }: { children?: React.ReactNode[] }) => {
      if (!children || children.length === 0) return null;
      return <h3 className="font-adonis text-2xl md:text-3xl font-bold text-gray-900 my-6 animate-fade-in-up animation-delay-200">{children}</h3>
    },
    h4: ({ children }: { children?: React.ReactNode[] }) => {
      if (!children || children.length === 0) return null;
      return <h4 className="font-adonis text-xl md:text-2xl font-bold text-gray-900 my-4 animate-fade-in-up animation-delay-200">{children}</h4>
    },
    blockquote: ({ children }: { children?: React.ReactNode[] }) => {
      if (!children || children.length === 0) return null;
      return <blockquote className="border-l-4 border-gray-300 pl-6 my-8 italic font-georgia-pro text-xl text-gray-700 animate-fade-in-up animation-delay-200">{children}</blockquote>
    },
    large: ({ children }: { children?: React.ReactNode[] }) => {
      if (!children || children.length === 0) return null;
      return <p className="font-georgia-pro text-xl md:text-2xl leading-relaxed my-8 text-gray-800 animate-fade-in-up animation-delay-100">{children}</p>
    },
  },
  list: {
    // ... your list components are unchanged
  },
}

interface PortableTextRendererProps {
  content: any[]
}

export function PortableTextRenderer({ content }: PortableTextRendererProps) {
  // Add a top-level check for safety
  if (!Array.isArray(content)) {
    return null;
  }
  return <PortableText value={content} components={components} />
}
