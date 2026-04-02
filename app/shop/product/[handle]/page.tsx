// This is a server component by default
import { notFound } from "next/navigation"
import Image from "next/image"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { getShopifyProduct } from "@/lib/shopify"
import { AddToCartButton } from "@/components/add-to-cart-button"

interface ProductPageProps {
  params: {
    handle: string
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getShopifyProduct(params.handle)

  if (!product) {
    notFound()
  }

  // Check if this is a premium product (for demo purposes, we'll consider products over $20 as premium)
  const isPremium = Number.parseFloat(product.price) > 20

  function formatPrice(price: string, currency: string): string {
    const numericPrice = Number.parseFloat(price)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(numericPrice)
  }

  return (
    <main className="min-h-screen">
      <Header />

      <section className="py-16 md:py-24">
        <div className="container-magazine">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
              <Image
                src={product.image || "/placeholder.svg"}
                alt={product.imageAlt}
                fill
                className="object-cover"
                priority
              />
            </div>

            <div>
              <h1 className="font-adonis-bold text-3xl md:text-4xl">{product.title}</h1>
              <p className="mt-4 font-georgia-pro text-2xl text-gray-900">
                {formatPrice(product.price, product.currency)}
              </p>

              <div className="mt-8 prose font-georgia-pro">
                <p>{product.description}</p>
              </div>

              {isPremium ? (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <h3 className="font-adonis text-lg mb-2">Member Exclusive</h3>
                  <p className="font-georgia-pro text-gray-600 mb-4">
                    This premium product is available exclusively to Knead members. Unlock now to purchase.
                  </p>
                  <WalletConnectButton />
                </div>
              ) : (
                <div className="mt-8">
                  <AddToCartButton product={product} />
                </div>
              )}

              <UnlockContent contentId={`product-${product.id}`}>
                <div className="mt-8">
                  {isPremium && (
                    <div className="mb-4 p-2 bg-green-50 rounded text-green-800 font-georgia-pro text-sm">
                      Member discount applied: 10% off
                    </div>
                  )}
                  <AddToCartButton product={product} />
                </div>
              </UnlockContent>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="font-adonis text-lg mb-2">Details</h3>
                <ul className="font-georgia-pro text-gray-600 space-y-2">
                  <li>Shipping: 3-5 business days</li>
                  <li>Free returns within 30 days</li>
                  <li>Handpicked to enhance your reading experience</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-16">
            <Link href="/shop" className="font-georgia-pro text-gray-600 hover:text-black">
              ← Back to shop
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-12">
        <div className="container-magazine">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="font-georgia-pro text-gray-500">© {new Date().getFullYear()} Knead. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="/about" className="font-georgia-pro text-gray-500 hover:text-gray-900 transition-colors">
                About
              </a>
              <a href="/join" className="font-georgia-pro text-gray-500 hover:text-gray-900 transition-colors">
                Join
              </a>
              <a href="/shop" className="font-georgia-pro text-gray-500 hover:text-gray-900 transition-colors">
                Shop
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
