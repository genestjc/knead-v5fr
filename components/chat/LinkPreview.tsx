'use client';

import { useState, useEffect } from 'react';

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

const cache = new Map<string, LinkPreviewData | null>();

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

interface LinkPreviewProps {
  url: string;
  isOwn?: boolean;
}

export function LinkPreview({ url, isOwn = false }: LinkPreviewProps) {
  const [data, setData] = useState<LinkPreviewData | null | undefined>(
    cache.has(url) ? cache.get(url) : undefined
  );

  useEffect(() => {
    if (cache.has(url)) {
      setData(cache.get(url));
      return;
    }

    const ytId = extractYouTubeId(url);
    if (ytId) {
      const preview: LinkPreviewData = {
        title: null,
        description: null,
        image: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
        siteName: 'YouTube',
        url,
      };
      cache.set(url, preview);
      setData(preview);

      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.title) {
            const full = { ...preview, title: d.title, description: d.description };
            cache.set(url, full);
            setData(full);
          }
        })
        .catch(() => {});
      return;
    }

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d: LinkPreviewData) => {
        const result = d.title || d.image ? d : null;
        cache.set(url, result);
        setData(result);
      })
      .catch(() => {
        cache.set(url, null);
        setData(null);
      });
  }, [url]);

  if (data === undefined) return null;
  if (data === null) return null;
  if (!data.title && !data.image) return null;

  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {}

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block mt-2 rounded-xl overflow-hidden border border-gray-200 bg-white hover:bg-gray-50 transition-colors max-w-[280px] ${isOwn ? 'self-end' : 'self-start'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {data.image && (
        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img
            src={data.image}
            alt={data.title ?? ''}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              // fallback: hqdefault → sddefault → hide
              if (img.src.includes('maxresdefault')) {
                img.src = img.src.replace('maxresdefault', 'hqdefault');
              } else if (img.src.includes('hqdefault')) {
                img.src = img.src.replace('hqdefault', 'sddefault');
              } else {
                img.style.display = 'none';
              }
            }}
          />
        </div>
      )}
      <div className="px-3 py-2">
        {data.siteName && (
          <p className="font-georgia-pro text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
            {data.siteName || domain}
          </p>
        )}
        {data.title && (
          <p className="font-adonis text-sm text-gray-900 leading-snug line-clamp-2">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="font-georgia-pro text-xs text-gray-500 mt-0.5 line-clamp-2">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

export function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])];
}
