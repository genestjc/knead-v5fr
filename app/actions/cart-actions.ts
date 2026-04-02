"use server"

import { cookies } from "next/headers"

// This is a server action that can be called from client components
export async function addToCart(productId: string, quantity = 1) {
  try {
    // Get the current cart from cookies or initialize a new one
    const cartCookie = cookies().get("cart")
    const cart = cartCookie ? JSON.parse(cartCookie.value) : { items: [] }

    // Check if the product is already in the cart
    const existingItemIndex = cart.items.findIndex((item: any) => item.productId === productId)

    if (existingItemIndex >= 0) {
      // Update quantity if product already exists
      cart.items[existingItemIndex].quantity += quantity
    } else {
      // Add new item
      cart.items.push({ productId, quantity })
    }

    // Store updated cart in cookies
    cookies().set("cart", JSON.stringify(cart), {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    return { success: true, cart }
  } catch (error) {
    console.error("Error adding to cart:", error)
    return { success: false, error: "Failed to add item to cart" }
  }
}
