import type React from "react"
import { PortableText } from "@portabletext/react"
import Image from "next/image"
import { urlFor } from "../lib/sanity"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism"

// Minimal replacement for the removed `stegaClean` import
const stegaClean = (value: unknown) =>
  typeof value === "string" ? value.replace(/__stega__\[[\s\S]*?\]__stega__/g, "").trim() : value

// YouTube embed component
const YouTubeEmbed = ({ value }: { value: { url: string; title?: string } }) => {
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const videoId = getYouTubeId(value.url)

  if (!videoId) {
    return (
      <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in-up">
        <p className="text-red-600 font-georgia-pro">Invalid YouTube URL</p>
      </div>
    )
  }

  return (
    <div className="my-8 animate-fade-in-up animation-delay-200">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-lg bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
          title={value.title || "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
        />
      </div>
      {value.title && (
        <p className="mt-3 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">
          {value.title}
        </p>
      )}
    </div>
  )
}

// Instagram embed component
const InstagramEmbed = ({ value }: { value: { url: string; caption?: string } }) => {
  const getInstagramId = (url: string) => {
    const regExp = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/
    const match = url.match(regExp)
    return match ? match[1] : null
  }

  const postId = getInstagramId(value.url)

  if (!postId) {
    return (
      <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in-up">
        <p className="text-red-600 font-georgia-pro">Invalid Instagram URL</p>
      </div>
    )
  }

  return (
    <div className="my-8 animate-fade-in-up animation-delay-200">
      <div className="flex justify-center">
        <div className="max-w-lg w-full">
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={`https://www.instagram.com/p/${postId}/`}
            data-instgrm-version="14"
            style={{
              background: "#FFF",
              border: "0",
              borderRadius: "3px",
              boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
              margin: "1px",
              maxWidth: "540px",
              minWidth: "326px",
              padding: "0",
              width: "99.375%",
            }}
          >
            <div style={{ padding: "16px" }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                <div
                  style={{
                    backgroundColor: "#F4F4F4",
                    borderRadius: "50%",
                    flexGrow: 0,
                    height: "40px",
                    marginRight: "14px",
                    width: "40px",
                  }}
                ></div>
                <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
                  <div
                    style={{
                      backgroundColor: "#F4F4F4",
                      borderRadius: "4px",
                      flexGrow: 0,
                      height: "14px",
                      marginBottom: "6px",
                      width: "100px",
                    }}
                  ></div>
                  <div
                    style={{
                      backgroundColor: "#F4F4F4",
                      borderRadius: "4px",
                      flexGrow: 0,
                      height: "14px",
                      width: "60px",
                    }}
                  ></div>
                </div>
              </div>
              <div style={{ padding: "19% 0" }}></div>
              <div style={{ display: "block", height: "50px", margin: "0 auto 12px", width: "50px" }}>
                <svg width="50px" height="50px" viewBox="0 0 60 60" version="1.1">
                  <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                    <g transform="translate(-511.000000, -20.000000)" fill="#000000">
                      <g>
                        <path d="M556.869,30.41 C554.814,30.41 553.148,32.076 553.148,34.131 C553.148,36.186 554.814,37.852 556.869,37.852 C558.924,37.852 560.59,36.186 560.59,34.131 C560.59,32.076 558.924,30.41 556.869,30.41 M541,60.657 C535.114,60.657 530.342,55.887 530.342,50 C530.342,44.114 535.114,39.342 541,39.342 C546.887,39.342 551.658,44.114 551.658,50 C551.658,55.887 546.887,60.657 541,60.657 M541,33.886 C532.1,33.886 524.886,41.1 524.886,50 C524.886,58.899 532.1,66.113 541,66.113 C549.9,66.113 557.115,58.899 557.115,50 C557.115,41.1 549.9,33.886 541,33.886 M565.378,62.101 C565.244,65.022 564.756,66.606 564.346,67.663 C563.803,69.06 563.154,70.057 562.106,71.106 C561.058,72.155 560.06,72.803 558.662,73.347 C557.607,73.757 556.021,74.244 553.102,74.378 C549.944,74.521 548.997,74.552 541,74.552 C533.003,74.552 532.056,74.521 528.898,74.378 C525.979,74.244 524.393,73.757 523.338,73.347 C521.94,72.803 520.942,72.155 519.894,71.106 C518.846,70.057 518.197,69.06 517.654,67.663 C517.244,66.606 516.755,65.022 516.623,62.101 C516.479,58.943 516.448,57.996 516.448,50 C516.448,42.003 516.479,41.056 516.623,37.899 C516.755,34.978 517.244,33.391 517.654,32.338 C518.197,30.938 518.846,29.942 519.894,28.894 C520.942,27.846 521.94,27.196 523.338,26.654 C524.393,26.244 525.979,25.756 528.898,25.623 C532.057,25.479 533.004,25.448 541,25.448 C548.997,25.448 549.943,25.479 553.102,25.623 C556.021,25.756 557.607,26.244 558.662,26.654 C560.06,27.196 561.058,27.846 562.106,28.894 C563.154,29.942 563.803,30.938 564.346,32.338 C564.756,33.391 565.244,34.978 565.378,37.899 C565.522,41.056 565.552,42.003 565.552,50 C565.552,57.996 565.522,58.943 565.378,62.101 M570.82,37.631 C570.674,34.438 570.167,32.258 569.425,30.349 C568.659,28.377 567.633,26.702 565.965,25.035 C564.297,23.368 562.623,22.342 560.652,21.575 C558.743,20.834 556.562,20.326 553.369,20.18 C550.169,20.033 549.148,20 541,20 C532.853,20 531.831,20.033 528.631,20.18 C525.438,20.326 523.257,20.834 521.349,21.575 C519.376,22.342 517.703,23.368 516.035,25.035 C514.368,26.702 513.342,28.377 512.574,30.349 C511.834,32.258 511.326,34.438 511.181,37.631 C511.035,40.831 511,41.851 511,50 C511,58.147 511.035,59.17 511.181,62.369 C511.326,65.562 511.834,67.743 512.574,69.651 C513.342,71.625 514.368,73.296 516.035,74.965 C517.703,76.634 519.376,77.658 521.349,78.425 C523.257,79.167 525.438,79.673 528.631,79.82 C531.831,79.965 532.853,80.001 541,80.001 C549.148,80.001 550.169,79.965 553.369,79.82 C556.562,79.673 558.743,79.167 560.652,78.425 C562.623,77.658 564.297,76.634 565.965,74.965 C567.633,73.296 568.659,71.625 569.425,69.651 C570.167,67.743 570.674,65.562 570.82,62.369 C570.966,59.17 571,58.147 571,50 C571,41.851 570.966,40.831 570.82,37.631"></path>
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
              <div style={{ paddingTop: "8px" }}>
                <div
                  style={{
                    color: "#3897f0",
                    fontFamily: "Arial,sans-serif",
                    fontSize: "14px",
                    fontStyle: "normal",
                    fontWeight: 550,
                    lineHeight: "18px",
                  }}
                >
                  View this post on Instagram
                </div>
              </div>
            </div>
          </blockquote>
          <script async src="//www.instagram.com/embed.js"></script>
        </div>
      </div>
      {value.caption && (
        <p className="mt-3 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">
          {value.caption}
        </p>
      )}
    </div>
  )
}

// X (Twitter) embed component
const TwitterEmbed = ({ value }: { value: { url: string; caption?: string } }) => {
  const getTweetId = (url: string) => {
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/
    const match = url.match(regExp)
    return match ? match[1] : null
  }

  const tweetId = getTweetId(value.url)

  if (!tweetId) {
    return (
      <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in-up">
        <p className="text-red-600 font-georgia-pro">Invalid X/Twitter URL</p>
      </div>
    )
  }

  return (
    <div className="my-8 animate-fade-in-up animation-delay-200">
      <div className="flex justify-center">
        <div className="max-w-lg w-full">
          <blockquote className="twitter-tweet" data-theme="light" data-width="550">
            <p lang="en" dir="ltr">
              <a
                href={value.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View this post on X
              </a>
            </p>
          </blockquote>
          <script async src="https://platform.twitter.com/widgets.js" charSet="utf-8"></script>
        </div>
      </div>
      {value.caption && (
        <p className="mt-3 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">
          {value.caption}
        </p>
      )}
    </div>
  )
}

// Pull quote component
const PullQuote = ({ value }: { value: { text: string; author?: string } }) => (
  <div className="my-12 animate-fade-in-up animation-delay-100">
    <blockquote className="relative">
      <div className="text-center">
        <svg
          className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 w-8 h-8 text-gray-400 animate-fade-in animation-delay-200"
          fill="currentColor"
          viewBox="0 0 32 32"
        >
          <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
        </svg>
        <p className="font-adonis text-2xl md:text-3xl text-gray-900 leading-relaxed px-8 animate-fade-in-up animation-delay-300">
          {value.text}
        </p>
        {value.author && (
          <cite className="block mt-4 font-georgia-pro text-gray-600 not-italic animate-fade-in animation-delay-400">
            — {value.author}
          </cite>
        )}
      </div>
    </blockquote>
  </div>
)

// Code block component
const CodeBlock = ({ value }: { value: { language?: string; code: string; filename?: string } }) => (
  <div className="my-8 animate-fade-in-up animation-delay-200">
    {value.filename && (
      <div className="bg-gray-800 text-gray-300 px-4 py-2 text-sm font-mono rounded-t-lg border-b border-gray-700 animate-fade-in animation-delay-300">
        {value.filename}
      </div>
    )}
    <SyntaxHighlighter
      language={value.language || "text"}
      style={tomorrow}
      className={`${value.filename ? "rounded-t-none" : ""} rounded-lg animate-fade-in-up animation-delay-400`}
      showLineNumbers
    >
      {value.code}
    </SyntaxHighlighter>
  </div>
)

// Custom image component with animations
const CustomImage = ({ value }: { value: any }) => {
  const imageUrl = urlFor(value).width(800).height(600).url()

  return (
    <div className="my-8 animate-fade-in-up animation-delay-200">
      <div className="relative overflow-hidden rounded-lg shadow-lg">
        <Image
          src={imageUrl || "/placeholder.svg"}
          alt={value.alt || "Article image"}
          width={800}
          height={600}
          className="w-full h-auto object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
      {value.caption && (
        <p className="mt-2 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">
          {value.caption}
        </p>
      )}
    </div>
  )
}

// Portable text components
const components = {
  types: {
    image: CustomImage,
    youtube: YouTubeEmbed,
    instagram: InstagramEmbed,
    twitter: TwitterEmbed,
    pullQuote: PullQuote,
    code: CodeBlock,
  },
  marks: {
    link: ({ children, value }: { children: React.ReactNode; value: any }) => (
      <a
        href={value.href}
        target={value.blank ? "_blank" : "_self"}
        rel={value.blank ? "noopener noreferrer" : undefined}
        className="text-blue-600 hover:text-blue-800 underline transition-colors duration-300"
      >
        {children}
      </a>
    ),
    highlight: ({ children, value }: { children: React.ReactNode; value: any }) => (
      <span
        className={`px-1 py-0.5 rounded transition-all duration-300 ${
          value.color === "yellow"
            ? "bg-yellow-200"
            : value.color === "green"
              ? "bg-green-200"
              : value.color === "blue"
                ? "bg-blue-200"
                : value.color === "pink"
                  ? "bg-pink-200"
                  : "bg-yellow-200"
        }`}
      >
        {children}
      </span>
    ),
    code: ({ children }: { children: React.ReactNode }) => (
      <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono transition-all duration-300">
        {children}
      </code>
    ),
  },
  block: {
    normal: ({ children }: { children: React.ReactNode }) => (
      <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700 animate-fade-in-up animation-delay-100">
        {children}
      </p>
    ),
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1 className="font-adonis text-4xl md:text-5xl font-bold text-gray-900 my-8 animate-fade-in-up animation-delay-200">
        {children}
      </h1>
    ),
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2 className="font-adonis text-3xl md:text-4xl font-bold text-gray-900 my-6 animate-fade-in-up animation-delay-200">
        {children}
      </h2>
    ),
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className="font-adonis text-2xl md:text-3xl font-bold text-gray-900 my-6 animate-fade-in-up animation-delay-200">
        {children}
      </h3>
    ),
    h4: ({ children }: { children: React.ReactNode }) => (
      <h4 className="font-adonis text-xl md:text-2xl font-bold text-gray-900 my-4 animate-fade-in-up animation-delay-200">
        {children}
      </h4>
    ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className="border-l-4 border-gray-300 pl-6 my-8 italic font-georgia-pro text-xl text-gray-700 animate-fade-in-up animation-delay-200">
        {children}
      </blockquote>
    ),
    large: ({ children }: { children: React.ReactNode }) => (
      <p className="font-georgia-pro text-xl md:text-2xl leading-relaxed my-8 text-gray-800 animate-fade-in-up animation-delay-100">
        {children}
      </p>
    ),
  },
  list: {
    bullet: ({ children }: { children: React.ReactNode }) => (
      <ul className="list-disc list-inside my-6 space-y-2 font-georgia-pro text-lg text-gray-700 animate-fade-in-up animation-delay-100">
        {children}
      </ul>
    ),
    number: ({ children }: { children: React.ReactNode }) => (
      <ol className="list-decimal list-inside my-6 space-y-2 font-georgia-pro text-lg text-gray-700 animate-fade-in-up animation-delay-100">
        {children}
      </ol>
    ),
  },
}

interface PortableTextRendererProps {
  content: any[]
}

export function PortableTextRenderer({ content }: PortableTextRendererProps) {
  return <PortableText value={content} components={components} />
}
