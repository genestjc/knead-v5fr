export interface Author {
  id: string
  name: string
  bio?: string
  avatar?: string
}

export interface Post {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  coverImage?: string
  publishedAt: string
  author: Author
  isPremium?: boolean
}

export interface ShopifyProduct {
  id: string
  title: string
  description: string
  handle: string
  price: string
  currency: string
  image: string
  imageAlt: string
  images?: Array<{ url: string; altText: string }> // For product detail page
}
