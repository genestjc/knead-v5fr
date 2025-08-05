"use client";

import React, { useState, useEffect } from "react"
import type { ReactNode } from "react"
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

// Membership contract addresses
const MEMBERSHIP_CONTRACTS = {
  KNEAD: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string,
  ANNUAL_2025: "0xa4b1aF8cffEE71D71721cB69596c9A31ac449F13", 
  SHIFT_MEAL: "0xa4b1aF8cffEE71D71721cB69596c9A31ac449F13", // Same as ANNUAL_2025
  BREADWINNERS_CLUB: "0x0e70AB324E8761E97f131Eecc4Dd63dFDE33cB72"
}

// Single-story pass contracts mapped to story slugs
const SINGLE_STORY_PASSES: Record<string, string> = {
  // Core story passes
  somehoodlum: "0x0d6bd8aa6acf52d2dd23d4f74fed88b7e3cfc2c6",
  "how-luxury-has-led-web3": "0xc3b7aae8de9100554bbdea648cda311adcf3ef30",
  "the-role-of-genetics-in-cannabis": "0x2ad4f2e44c2c2855997cded05b2b025be094ac46",
  fvckrender: "0x5feff3c55cc6155ab80b92960c7be6a6961d977d",
  "nicola-formichetti-talks-joining-syky": "0x3e58e2c69970a84f628347546de9fe774fadfd1a",
  "dj-harrison": "0x093d46cd7d2b0785870a7092514bb27aae671d68",
  mntge: "0xd18225e9d9292f94b3b8d69561b5d647711504b2",
  "daniel-harthausen": "0x134f97ab28c727e42204feb75278526f87738ad0",
  "young-flexico": "0x626ec0fcb91e873f149f53874309f79b87fb3317",
  "sean-anderson-sol3mates": "0x2586346af2e1a0353cd5fee952e6673c96adb7d6",
  "joey-khamis": "0x08249549c9c29631d2904bf1c0175c0145a27e60",
  "evan-parker-mantel": "0x13b02c363e8eb8a0e0415005176c169d050c07f2",
  "nina-chanel-abney": "0xa391369b07cf2c6fd9964b045f4468d8be38a22d",
  "jeremiah-morris": "0x3b0b3fab4a4ef291ccaf516d4f1862bbb8108265",
  meshfair: "0xcf456ea4400cb3236d686e77fa8d229d567e9edf",
  "gmoney-9dcc-nines": "0x3ae58546ddd4144e698a54fd4cd5704b88ffab6d",
  "clay-hoss-helens": "0x7b8fbf635c681aebd2ddc7ace79213b695dc7e72",
  "dylan-abruscato-crypto-game": "0x048ac7715eb857e062a0d403e0e3dedbb48dc46f",
  "julian-holguin-doodles": "0x25ac04f217a4a5f3c6149c8ee688e388cf8e29e7",
  animal: "0xd7a11b5ae53949bdaac913b2423182a5afbbdd7a",
  towns: "0x5d27b7ef465a1d5164649447aa8660f15cb463bb",
  "decentraland-music-festival": "0x1c0765d04328dd6cae84a5fadb7371317b14c6ec",
  "gmoney-9dcc-black-box": "0xb6a1f823c2ae46c63e1f0262bd6a0e473fa52f37",
  "blvck-svm": "0x1ff6ccfd3b48aa1711f40aef2b7dd0134bc15d2d"
}

// Helper function to normalize slugs for comparison
function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '-');
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
      // Normalize the contentId to handle different slug formats
      const normalizedContentId = normalizeSlug(contentId)
      const singleStoryContract = SINGLE_STORY_PASSES[normalizedContentId] || 
                                  Object.entries(SINGLE_STORY_PASSES).find(
                                    ([key]) => normalizeSlug(key) === normalizedContentId
                                  )?.[1];
      
      if (singleStoryContract) {
        try {
          console.log(`Checking single-story pass for ${contentId} at ${singleStoryContract}`)
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
