import type { ShopifyProduct } from "./types"

// Use server-side only environment variables (without NEXT_PUBLIC_ prefix)
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "your-store.myshopify.com"
const SHOPIFY_STOREFRONT_ACCESS_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "your-storefront-access-token"

// Helper function to fetch from Shopify Storefront API
async function shopifyFetch({ query, variables }: { query: string; variables?: any }) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/api/2023-10/graphql.json`

  try {
    const result = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 60 }, // Cache for 60 seconds
    })

    return await result.json()
  } catch (error) {
    console.error("Error fetching from Shopify:", error)
    return { data: {} }
  }
}

// Get all products
export async function getShopifyProducts(): Promise<ShopifyProduct[]> {
  try {
    const query = `
      {
        products(first: 12) {
          edges {
            node {
              id
              title
              handle
              description
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    `

    const response = await shopifyFetch({ query })

    if (!response.data?.products?.edges) {
      console.error("No products found in Shopify response:", response)
      return getMockProducts() // Fallback to mock products
    }

    return response.data.products.edges.map(({ node }: any) => ({
      id: node.id,
      title: node.title,
      description: node.description,
      handle: node.handle,
      price: node.priceRange.minVariantPrice.amount,
      currency: node.priceRange.minVariantPrice.currencyCode,
      image: node.images.edges[0]?.node.url || "/diverse-products-still-life.png",
      imageAlt: node.images.edges[0]?.node.altText || node.title,
    }))
  } catch (error) {
    console.error("Error getting products from Shopify:", error)
    return getMockProducts() // Fallback to mock products
  }
}

// Mock products for development/fallback
export function getMockProducts(): ShopifyProduct[] {
  return [
    {
      id: "mock-1",
      title: "Handcrafted Bookmark Set",
      description: "A set of 5 handcrafted leather bookmarks with unique designs.",
      handle: "handcrafted-bookmark-set",
      price: "19.99",
      currency: "USD",
      image: "/placeholder.svg?key=smuz8",
      imageAlt: "Handcrafted Bookmark Set",
    },
    {
      id: "mock-2",
      title: "Reading Journal",
      description: "Elegant linen-bound reading journal with acid-free paper.",
      handle: "reading-journal",
      price: "24.99",
      currency: "USD",
      image: "/placeholder.svg?key=wrmid",
      imageAlt: "Reading Journal",
    },
    {
      id: "mock-3",
      title: "Ceramic Mug",
      description: "Handmade ceramic mug perfect for your reading sessions.",
      handle: "ceramic-mug",
      price: "18.99",
      currency: "USD",
      image: "/placeholder.svg?key=yf5zp",
      imageAlt: "Ceramic Mug",
    },
    {
      id: "mock-4",
      title: "Knead Tote Bag",
      description: "Canvas tote bag featuring the Knead logo.",
      handle: "knead-tote-bag",
      price: "15.99",
      currency: "USD",
      image: "/canvas-tote-bag.png",
      imageAlt: "Knead Tote Bag",
    },
    {
      id: "mock-5",
      title: "Reading Light",
      description: "Clip-on reading light with adjustable brightness.",
      handle: "reading-light",
      price: "29.99",
      currency: "USD",
      image: "/placeholder.svg?key=uoml8",
      imageAlt: "Reading Light",
    },
    {
      id: "mock-6",
      title: "Letterpress Notecards",
      description: "Set of 10 letterpress notecards with envelopes.",
      handle: "letterpress-notecards",
      price: "16.99",
      currency: "USD",
      image: "/placeholder.svg?key=9i32r",
      imageAlt: "Letterpress Notecards",
    },
  ]
}

// Get a single product by handle
export async function getShopifyProduct(handle: string): Promise<ShopifyProduct | null> {
  try {
    const query = `
      {
        productByHandle(handle: "${handle}") {
          id
          title
          handle
          description
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
        }
      }
    `

    const response = await shopifyFetch({ query })
    const product = response.data?.productByHandle

    if (!product) {
      return null
    }

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      price: product.priceRange.minVariantPrice.amount,
      currency: product.priceRange.minVariantPrice.currencyCode,
      image: product.images.edges[0]?.node.url || "/diverse-products-still-life.png",
      imageAlt: product.images.edges[0]?.node.altText || product.title,
      images: product.images.edges.map(({ node }: any) => ({
        url: node.url,
        altText: node.altText || product.title,
      })),
    }
  } catch (error) {
    console.error("Error getting product from Shopify:", error)

    // Return a mock product if in development
    const mockProducts = getMockProducts()
    return mockProducts.find((p) => p.handle === handle) || null
  }
}
