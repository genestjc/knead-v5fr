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
