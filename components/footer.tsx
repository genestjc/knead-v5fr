import Link from "next/link"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 py-16 mt-12">
      <div className="container-magazine">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-12 mb-12">
          <div className="text-center md:text-left">
            <h3 className="font-adonis text-xl text-gray-400 hover:text-black transition-colors">
              <Link href="/about">About</Link>
            </h3>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-adonis text-xl text-gray-400 hover:text-black transition-colors">
              <Link href="/join">Join</Link>
            </h3>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-adonis text-xl text-gray-400 hover:text-black transition-colors">
              <Link href="/chat">Chat</Link>
            </h3>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-adonis text-xl text-gray-400 hover:text-black transition-colors">
              <Link href="/open-source">Open Source</Link>
            </h3>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-adonis text-xl text-gray-400 hover:text-black transition-colors">
              <Link href="/archive">Archive</Link>
            </h3>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-adonis text-xl text-gray-400 mb-4">Connect</h3>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.instagram.com/knead.mag/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-adonis text-sm text-gray-400 hover:text-black transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/kneadmag"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-adonis text-sm text-gray-400 hover:text-black transition-colors"
                >
                  X
                </a>
              </li>
              <li>
                <a
                  href="https://warpcast.com/knead"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-adonis text-sm text-gray-400 hover:text-black transition-colors"
                >
                  Farcaster
                </a>
              </li>
              <li>
                <a
                  href="https://zora.co/@knead"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-adonis text-sm text-gray-400 hover:text-black transition-colors"
                >
                  Zora
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center border-t border-gray-100 pt-8">
          <p className="font-georgia-pro text-gray-400">© {currentYear} Knead. All rights reserved.</p>
          <div className="mt-2 text-sm">
            <Link href="/privacy" className="font-georgia-pro text-gray-400 hover:text-black transition-colors">
              Privacy Policy
            </Link>
            <span className="font-georgia-pro text-gray-400 mx-2">|</span>
            <Link href="/terms" className="font-georgia-pro text-gray-400 hover:text-black transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
