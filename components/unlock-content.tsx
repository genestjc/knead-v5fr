import { useState, useEffect, type ReactNode } from "react"
import { useActiveAccount } from "thirdweb/react"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721"
import { base } from "thirdweb/chains"
import Paywall from "./paywall"
import SubscriptionFlow from "./SubscriptionFlow"
import { useMembership } from "@/components/membership-provider"
import { useToast } from "@/hooks/use-toast"
import { TOKEN_IDS, ARTICLE_LIMITS } from "@/lib/constants"

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
})

// Single-story pass contracts mapped to story slugs
const SINGLE_STORY_PASSES: Record<string, string> = {
  somehoodlum: "0x0d6bd8aa6acf52d2dd23d4f74fed88b7e3cfc2c6",
  // ... other story passes
}

interface UnlockContentProps {
  children: ReactNode
  contentId: string
}

export function UnlockContent({ children, contentId }: UnlockContentProps) {
  const account = useActiveAccount()
  const { membershipType, isLoading: membershipLoading, hasAccess } = useMembership()
  const [canAccess, setCanAccess] = useState<boolean | null>(null)
  const [articleCount, setArticleCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showSubscriptionFlow, setShowSubscriptionFlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!account?.address) {
      setCanAccess(false)
      setIsLoading(false)
      return
    }

    checkAccess()
  }, [account?.address, contentId])

  const checkAccess = async () => {
    if (!account?.address) return

    setIsLoading(true)
    setError(null)
    
    try {
      // First check if the user has a premium membership (fastest check)
      if (hasAccess("premium")) {
        console.log("Premium membership detected, granting access")
        setCanAccess(true)
        setIsLoading(false)
        return
      }
      
      // Then check for single-story passes
      const singleStoryContract = SINGLE_STORY_PASSES[contentId]
      if (singleStoryContract) {
        try {
          console.log(`Checking single-story pass for ${contentId}`)
          const contractInstance = getContract({
            client,
            chain: base,
            address: singleStoryContract,
          })

          const balance = await erc721BalanceOf({
            contract: contractInstance,
            owner: account.address,
          })

          if (balance > 0n) {
            console.log(`Single-story pass found for ${contentId}`)
            setCanAccess(true)
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error(`Error checking single-story pass for ${contentId}:`, error)
          toast({
            title: "Error",
            description: "Failed to verify story pass. Please try refreshing.",
            variant: "destructive",
          })
        }
      }

      // If user has freemium membership, check article count
      if (hasAccess("freemium")) {
        console.log("Freemium membership detected, checking article limit")
        await checkFreemiumLimit()
      } else {
        console.log("No membership detected")
        setCanAccess(false)
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error checking access:", error)
      setError("Failed to verify your access. Please try again.")
      toast({
        title: "Access Error",
        description: "We couldn't verify your membership status. Please try again.",
        variant: "destructive",
      })
      setCanAccess(false)
      setIsLoading(false)
    }
  }

  const checkFreemiumLimit = async () => {
    if (!account?.address) return

    try {
      const response = await fetch("/api/track-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_address: account.address.toLowerCase(),
          story_slug: contentId,
          checkOnly: true, // Just check, don't record yet
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setArticleCount(result.reads || 0)
        
        // If article already read, grant access without counting again
        if (result.alreadyRead) {
          setCanAccess(true)
          setIsLoading(false)
          return
        }
        
        // If user hasn't reached limit, record this view
        if ((result.reads || 0) < ARTICLE_LIMITS.FREEMIUM) {
          const trackResponse = await fetch("/api/track-article", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_address: account.address.toLowerCase(),
              story_slug: contentId,
            }),
          })
          
          if (trackResponse.ok) {
            setCanAccess(true)
          } else {
            const trackResult = await trackResponse.json()
            setError(trackResult.error || "Failed to record article view")
            setCanAccess(false)
          }
        } else {
          console.log(`User has reached article limit (${result.reads}/${ARTICLE_LIMITS.FREEMIUM})`)
          setCanAccess(false)
        }
      } else {
        setCanAccess(false)
        setError(result.error || "Failed to check article limit")
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error("Error checking freemium limit:", error)
      setCanAccess(false)
      setIsLoading(false)
      toast({
        title: "Error",
        description: "Failed to check your article limit. Please try refreshing.",
        variant: "destructive",
      })
    }
  }

  const handleSubscribe = () => {
    setShowSubscriptionFlow(true)
  }

  const handleSubscriptionSuccess = () => {
    setShowSubscriptionFlow(false)
    toast({
      title: "Success!",
      description: "Your premium membership has been activated.",
      variant: "default",
    })
    checkAccess()
  }

  // Loading state
  if (isLoading || membershipLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={checkAccess}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          Try Again
        </button>
      </div>
    )
  }

  // No wallet connected - show visitor paywall
  if (!account?.address) {
    return <Paywall />
  }

  // Freemium user reached article limit - show limit paywall
  if (canAccess === false && hasAccess("freemium") && articleCount >= ARTICLE_LIMITS.FREEMIUM) {
    return <Paywall onSubscribe={handleSubscribe} articleCount={articleCount} />
  }

  // Subscription modal
  if (showSubscriptionFlow) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-adonis">
              Join Knead Monthly
            </h2>
            <button
              onClick={() => setShowSubscriptionFlow(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <SubscriptionFlow
            onSuccess={handleSubscriptionSuccess}
          />
        </div>
      </div>
    )
  }

  // User has access
  return <>{children}</>
}
