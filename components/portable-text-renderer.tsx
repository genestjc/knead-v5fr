'use client'; // This directive is necessary for useEffect

import type React from "react"
import { useEffect } from "react";
import { PortableText } from "@portabletext/react"
import Image from "next/image"
import { urlFor } from "../lib/sanity"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism"

// YouTubeEmbed is fine as it uses an iframe, no script tag needed.
const YouTubeEmbed = ({ value }: { value: { url: string; title?: string } }) => {
    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? match[2] : null;
    };
    const videoId = getYouTubeId(value.url);
    if (!videoId) return <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600 font-georgia-pro">Invalid YouTube URL</p></div>;
    return <div className="my-8 animate-fade-in-up animation-delay-200"><div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-lg bg-black"><iframe src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`} title={value.title || "YouTube video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 w-full h-full border-0" loading="lazy"/></div>{value.title && <p className="mt-3 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">{value.title}</p>}</div>;
};

// **FIXED InstagramEmbed**
const InstagramEmbed = ({ value }: { value: { url: string; caption?: string } }) => {
    const getInstagramId = (url: string) => {
        const regExp = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };
    const postId = getInstagramId(value.url);

    useEffect(() => {
        // The Instagram script adds a global object `window.instgrm`
        // We can check for its existence and run its `process` method
        if (window.instgrm) {
            window.instgrm.Embeds.process();
        } else {
            // If the script doesn't exist, we inject it into the document
            const script = document.createElement('script');
            script.src = 'https://www.instagram.com/embed.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []); // Run this effect once when the component mounts

    if (!postId) {
        return <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600 font-georgia-pro">Invalid Instagram URL</p></div>;
    }

    // The blockquote is all the script needs to find and replace.
    return (
        <div className="my-8 flex justify-center">
            <blockquote
                className="instagram-media"
                data-instgrm-permalink={`https://www.instagram.com/p/${postId}/`}
                data-instgrm-version="14"
                style={{ maxWidth: "540px", width: "99.375%" }}
            >
            </blockquote>
        </div>
    );
};

// **FIXED TwitterEmbed**
const TwitterEmbed = ({ value }: { value: { url: string; caption?: string } }) => {
    const getTweetId = (url: string) => {
        const regExp = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };
    const tweetId = getTweetId(value.url);

    useEffect(() => {
        // The Twitter script adds a global object `window.twttr`
        if (window.twttr) {
            window.twttr.widgets.load();
        } else {
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.body.appendChild(script);
        }
    }, []);

    if (!tweetId) {
        return <div className="my-8 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600 font-georgia-pro">Invalid X/Twitter URL</p></div>;
    }

    // The blockquote is what the script looks for.
    return (
        <div className="my-8 flex justify-center">
            <blockquote className="twitter-tweet" data-theme="light">
                <a href={value.url}></a>
            </blockquote>
        </div>
    );
};

// Other components (PullQuote, CodeBlock, CustomImage) are unchanged...
const PullQuote = ({ value }: { value: { text: string; author?: string } }) => <div className="my-12 animate-fade-in-up animation-delay-100"><blockquote className="relative"><div className="text-center"><svg className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 w-8 h-8 text-gray-400 animate-fade-in animation-delay-200" fill="currentColor" viewBox="0 0 32 32"><path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" /></svg><p className="font-adonis text-2xl md:text-3xl text-gray-900 leading-relaxed px-8 animate-fade-in-up animation-delay-300">{value.text}</p>{value.author && <cite className="block mt-4 font-georgia-pro text-gray-600 not-italic animate-fade-in animation-delay-400">— {value.author}</cite>}</div></blockquote></div>;
const CodeBlock = ({ value }: { value: { language?: string; code: string; filename?: string } }) => <div className="my-8 animate-fade-in-up animation-delay-200">{value.filename && <div className="bg-gray-800 text-gray-300 px-4 py-2 text-sm font-mono rounded-t-lg border-b border-gray-700 animate-fade-in animation-delay-300">{value.filename}</div>}<SyntaxHighlighter language={value.language || "text"} style={tomorrow} className={`${value.filename ? "rounded-t-none" : ""} rounded-lg animate-fade-in-up animation-delay-400`} showLineNumbers>{value.code}</SyntaxHighlighter></div>;
const CustomImage = ({ value }: { value: any }) => {
  if (!value?.asset) return null;
  const imageUrl = urlFor(value).width(1600).fit("max").quality(100).url();
  return <div className="my-8 animate-fade-in-up animation-delay-200"><div className="relative overflow-hidden rounded-lg shadow-lg"><Image src={imageUrl || "/placeholder.svg"} alt={value.alt || "Article image"} width={1600} height={900} quality={100} className="w-full h-auto transition-transform duration-500 hover:scale-105" /></div>{value.caption && <p className="mt-2 text-sm text-gray-600 text-center font-georgia-pro italic animate-fade-in animation-delay-300">{value.caption}</p>}</div>;
};


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
    link: ({ children, value }: { children: React.ReactNode; value: any }) => <a href={value.href} target={value.blank ? "_blank" : "_self"} rel={value.blank ? "noopener noreferrer" : undefined} className="text-blue-600 hover:text-blue-800 underline transition-colors duration-300">{children}</a>,
    highlight: ({ children, value }: { children: React.ReactNode; value: any }) => <span className={`px-1 py-0.5 rounded transition-all duration-300 ${value.color === "yellow" ? "bg-yellow-200" : value.color === "green" ? "bg-green-200" : value.color === "blue" ? "bg-blue-200" : value.color === "pink" ? "bg-pink-200" : "bg-yellow-200"}`}>{children}</span>,
    code: ({ children }: { children: React.ReactNode }) => <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono transition-all duration-300">{children}</code>,
  },
  block: {
    normal: ({ children }: { children?: React.ReactNode[] }) => {
      if (!Array.isArray(children) || (children.length === 1 && children[0] === '')) return null;
      return <p className="font-georgia-pro text-lg leading-relaxed my-6 text-gray-700 animate-fade-in-up animation-delay-100">{children}</p>;
    },
    h1: ({ children }: { children?: React.ReactNode[] }) => (!Array.isArray(children) || children.length === 0) ? null : <h1 className="font-adonis text-4xl md:text-5xl font-bold text-gray-900 my-8 animate-fade-in-up animation-delay-200">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode[] }) => (!Array.isArray(children) || children.length === 0) ? null : <h2 className="font-adonis text-3xl md:text-4xl font-bold text-gray-900 my-6 animate-fade-in-up animation-delay-200">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode[] }) => (!Array.isArray(children) || children.length === 0) ? null : <h3 className="font-adonis text-2xl md:text-3xl font-bold text-gray-900 my-6 animate-fade-in-up animation-delay-200">{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode[] }) => (!Array.isArray(children) || children.length === 0) ? null : <h4 className="font-adonis text-xl md:text-2xl font-bold text-gray-900 my-4 animate-fade-in-up animation-delay-200">{children}</h4>,
    blockquote: ({ children }: { children?: React.ReactNode[] }) => (!Array.isArray(children) || children.length === 0) ? null : <blockquote className="border-l-4 border-gray-300 pl-6 my-8 italic font-georgia-pro text-xl text-gray-700 animate-fade-in-up animation-delay-200">{children}</blockquote>,
    large: ({ children }: { children?: React.ReactNode[] }) => (!Array.isArray(children) || children.length === 0) ? null : <p className="font-georgia-pro text-xl md:text-2xl leading-relaxed my-8 text-gray-800 animate-fade-in-up animation-delay-100">{children}</p>,
  },
  list: {
    bullet: ({ children }: { children: React.ReactNode }) => <ul className="list-disc list-inside my-6 space-y-2 font-georgia-pro text-lg text-gray-700 animate-fade-in-up animation-delay-100">{children}</ul>,
    number: ({ children }: { children: React.ReactNode }) => <ol className="list-decimal list-inside my-6 space-y-2 font-georgia-pro text-lg text-gray-700 animate-fade-in-up animation-delay-100">{children}</ol>,
  },
};

interface PortableTextRendererProps {
  content: any[];
}

export function PortableTextRenderer({ content }: PortableTextRendererProps) {
  if (!Array.isArray(content)) {
    return null;
  }
  return <PortableText value={content} components={components} />;
}
