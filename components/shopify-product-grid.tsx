import Link from "next/link"
import Image from "next/image"
import type { ShopifyProduct } from "@/lib/types"

interface ShopifyProductGridProps {
  products: ShopifyProduct[]
}

export function ShopifyProductGrid({ products }: ShopifyProductGridProps) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-georgia-pro text-gray-500">No products found.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {products.map((product) => (
        <Link key={product.id} href={`/shop/product/${product.handle}`} className="group">
          <div className="product-card">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100 mb-4">
              <Image
                src={product.image || "/placeholder.svg"}
                alt={product.imageAlt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <h3 className="font-adonis text-xl leading-tight group-hover:underline">{product.title}</h3>
            <p className="mt-2 font-georgia-pro text-gray-700">{formatPrice(product.price, product.currency)}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

function formatPrice(price: string, currency: string): string {
  const numericPrice = Number.parseFloat(price)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(numericPrice)
}
