'use client';

/**
 * Live demo: the real Probatio Parsley console, in a frame.
 *
 * This one is an iframe rather than a reproduction. The console is tabs,
 * rubric editing, stepped runs and a grading panel — rebuilding a convincing
 * copy would be a second implementation to keep in step with the first, and
 * the whole claim of the slide is that the thing exists and works.
 *
 * It loads only once the slide is actually approached. The console pulls its
 * own weight in JavaScript, and a deck that spends it on page load makes the
 * first slide slow for a visitor who may never scroll this far.
 *
 * Same-origin, so the CSP's `frame-ancestors 'self'` permits the embed.
 */
import { useEffect, useRef, useState } from 'react';
import { LiveBadge } from './deck-chat';

export function DemoProbatio() {
  const holderRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || load) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true);
          observer.disconnect();
        }
      },
      // Start loading a slide early, so the console is warm on arrival.
      { rootMargin: '600px' },
    );

    observer.observe(holder);
    return () => observer.disconnect();
  }, [load]);

  return (
    <div ref={holderRef} className="border border-white/10 bg-black w-full">
      <div className="flex items-center justify-between gap-4 px-5 md:px-6 py-4 border-b border-white/10">
        <div>
          <p className="font-adonis text-lg text-white leading-none mb-1.5">Probatio Parsley</p>
          <LiveBadge>Live · the console itself</LiveBadge>
        </div>
        <a
          href="/probatio-parsley"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-georgia-pro text-[11px] text-white/40 hover:text-white transition-colors"
        >
          Open full screen ↗
        </a>
      </div>

      {/* An iframe prints as a white rectangle and pushes the slide onto a
          second page — on paper the sentence below stands in for it. */}
      <div className="relative bg-white h-[300px] md:h-[360px] print:hidden">
        {load ? (
          <iframe
            src="/probatio-parsley"
            title="Probatio Parsley evaluation console"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-georgia-pro text-sm text-gray-400">Loading the console…</p>
          </div>
        )}
      </div>

      {/* An iframe prints blank, so print gets a sentence instead of a hole. */}
      <p className="hidden print:block px-6 py-4 font-georgia-pro text-sm text-white/50">
        The live console is embedded here — open the deck in a browser to drive it, or go to
        kneadmag.com/probatio-parsley.
      </p>

      <p className="px-5 md:px-6 py-3 font-georgia-pro text-[11px] text-white/30 leading-relaxed border-t border-white/10">
        Set a rubric row, pick a persona, and step a run against a live surface — the transcript
        and its behavior log build as it goes. Runs spend real model budget and hit production
        endpoints, because that is the point of them.
      </p>
    </div>
  );
}
