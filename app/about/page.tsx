import { Header } from "@/components/header"
import { Instagram, Twitter } from "lucide-react"

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-24 md:py-32">
        <div className="container-magazine text-center">
          {/* Animated tagline */}
          <div className="mb-16 animate-fade-in-up">
            <p className="text-2xl md:text-3xl font-adonis italic text-gray-800 mb-6">
              "Nourishment for the creative spirit."
            </p>
          </div>

          {/* Animated main copy */}
          <div className="mb-20 animate-fade-in-up-delay">
            <p className="text-lg md:text-xl font-georgia-pro text-gray-700 max-w-3xl mx-auto">
              Knead is a magazine that covers art, music, food, tech, and other creative disciplines.
            </p>
          </div>

          {/* Connect with us section */}
          <div className="animate-fade-in-up-delay-3">
            <h2 className="text-2xl md:text-3xl font-adonis mb-12">Connect with us</h2>
            <div className="flex justify-center space-x-12 mb-16">
              <a
                href="https://www.instagram.com/knead.mag/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-black transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={36} />
              </a>
              <a
                href="https://x.com/kneadmag"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-black transition-colors"
                aria-label="X (Twitter)"
              >
                <Twitter size={36} />
              </a>
              <a
                href="https://warpcast.com/knead"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-black transition-colors"
                aria-label="Farcaster"
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor">
                  {/* Brandenburg Gate style Farcaster logo */}
                  <g transform="translate(4, 6)">
                    {/* Left column */}
                    <rect x="2" y="4" width="3" height="16" />
                    <rect x="0" y="18" width="7" height="2" />
                    <rect x="1" y="20" width="5" height="2" />
                    <rect x="0.5" y="22" width="6" height="2" />

                    {/* Right column */}
                    <rect x="23" y="4" width="3" height="16" />
                    <rect x="21" y="18" width="7" height="2" />
                    <rect x="22" y="20" width="5" height="2" />
                    <rect x="21.5" y="22" width="6" height="2" />

                    {/* Top connecting structure */}
                    <rect x="2" y="2" width="24" height="2" />
                    <rect x="0" y="0" width="28" height="2" />

                    {/* Arch opening */}
                    <path d="M 8 20 Q 14 8 20 20" stroke="none" fill="white" />
                    <ellipse cx="14" cy="16" rx="6" ry="8" fill="white" />
                  </g>
                </svg>
              </a>
              <a
                href="https://zora.co/@knead"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-black transition-colors"
                aria-label="Zora"
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor">
                  <defs>
                    <radialGradient id="zoraGradient" cx="0.3" cy="0.3" r="0.8">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="currentColor" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
                    </radialGradient>
                  </defs>
                  <circle cx="18" cy="18" r="16" fill="url(#zoraGradient)" />
                  <ellipse cx="14" cy="14" rx="4" ry="6" fill="currentColor" opacity="0.3" />
                </svg>
              </a>
            </div>

            {/* Email address */}
            <div className="text-gray-600 mt-8">
              <a
                href="mailto:hello@kneadmag.com"
                className="font-georgia-pro italic text-lg hover:text-black transition-colors"
              >
                hello@kneadmag.com
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
