import { Header } from "@/components/header"

export default function ShopPage() {
  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <h1 className="font-adonis text-5xl md:text-6xl font-normal mb-8">Shop</h1>

          <div className="bg-gray-50 rounded-lg border border-gray-100 p-12 text-center">
            <h2 className="font-adonis text-3xl mb-4">Coming Soon</h2>
            <p className="font-georgia-pro text-lg text-gray-600 max-w-2xl mx-auto">
              We anticipate to drop our first drop, S-Tier, Fall 2025.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
