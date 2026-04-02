import Link from "next/link"
import { Header } from "@/components/header"

export default function NotFound() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="font-adonis text-6xl md:text-8xl font-normal mb-8 text-gray-900">404</h1>

            <h2 className="font-adonis text-2xl md:text-3xl font-normal mb-6 text-gray-700">Page Not Found</h2>

            <p className="font-georgia-pro text-lg mb-8 text-gray-600 leading-relaxed">
              The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong
              URL.
            </p>

            <div className="space-y-4">
              <Link
                href="/"
                className="inline-block bg-black text-white px-8 py-3 rounded hover:bg-gray-800 transition-colors font-adonis text-lg"
              >
                Return Home
              </Link>

              <div className="text-center">
                <Link
                  href="/archive"
                  className="font-adonis text-gray-600 hover:text-gray-900 transition-colors underline"
                >
                  Browse All Articles
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
