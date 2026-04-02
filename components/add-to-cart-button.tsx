"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import type { ShopifyProduct } from "@/lib/types"
import { addToCart } from "@/app/actions/cart-actions"

interface AddToCartButtonProps {
  product: ShopifyProduct
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)

  const handleAddToCart = async () => {
    setIsAdding(true)

    try {
      // Call the server action to add the product to cart
      const result = await addToCart(product.id, 1)

      if (result.success) {
        setIsAdded(true)
        setTimeout(() => {
          setIsAdded(false)
        }, 3000)
      } else {
        console.error("Failed to add to cart:", result.error)
      }
    } catch (error) {
      console.error("Failed to add to cart:", error)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Button onClick={handleAddToCart} disabled={isAdding} className="w-full md:w-auto py-6 px-8 text-base">
      <ShoppingCart className="mr-2 h-5 w-5" />
      {isAdding ? "Adding..." : isAdded ? "Added to Cart!" : "Add to Cart"}
    </Button>
  )
}
