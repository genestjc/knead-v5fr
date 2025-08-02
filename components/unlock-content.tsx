"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useActiveAccount } from "thirdweb/react"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721"
import { base } from "thirdweb/chains"
import Paywall from "./paywall"
import SubscriptionFlow from "./SubscriptionFlow"
import { useMembership } from "@/components/membership-provider"

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
})

// Single-story pass contracts mapped to story slugs
const SINGLE_STORY_PASSES: Record<string, string> = {
  somehoodlum: "0x0d6bd8aa6acf52d2dd23d4f74fed88b7e3cfc2c6",
  "how-luxury-has-led-web3": "0xc3b7aae8de9100554bbdea648cda311adcf3ef30",
  "the-role-of-genetics-in-cannabis": "0x2ad4f2e44c2c2855997cded05b2b025be094ac46",
  fvckrender: "0x5feff3c55cc6155ab80b92960c7be6a6961d977d",
  "nicola-formichetti-talks-joining-syky-as-artistic-director": "0x3e58e2c69970a84f628347546de9fe774fadfd1a",
  "dj-harrison": "0x093d46cd7d2b0785870a7092514bb27aae671d68",
  mntge: "0xd18225e9d9292f94b3b8d69561b5d647711504b2",
  "daniel-harthausen": "0x134f97ab28c727e42204feb75278526f87738ad0",
  "young-flexico": "0x626ec0fcb91e873f149f53874309f79b87fb3317",
  "sean-anderson-of-sol3mates": "0x2586346af2e1a0353cd5fee952e6673c96adb7d6",
  "joey-khamis": "0x08249549c9c29631d2904bf1c0175c0145a27e60",
  "evan-parker-of-mantel": "0x13b02c363e8eb8a0e0415005176c169d050c07f2",
  "nina-chanel-abney": "0xa391369b07cf2c6fd9964b045f4468d8be38a22d",
  "jeremiah-morris": "0x3b0b3fab4a4ef291ccaf516d4f1862bbb8108265",
  meshfair: "0xcf456ea4400cb3236d686e77fa8d229d567e9edf",
  "gmoney-talks-9dcc-nines-program": "0x3ae58546ddd4144e698a54fd4cd5704b88ffab6d",
  "clay-hoss-of-helens": "0x7b8fbf635c681aebd2ddc7ace79213b695dc7e72",
  "dylan-abruscato-of-crypto-the-game": "0x048ac7715eb857e062a0d403e0e3dedbb48dc46f",
  "julian-holguin-of-doodles": "0x25ac04f217a4a5f3c6149c8ee688e388cf8e29e7",
  animal: "0xd7a11b5ae53949bdaac913b2423182a5afbbdd7a",
  towns: "0x5d27b7ef465a1d5164649447aa8660f15cb463bb",
  "decentraland-music-festival": "0x1c0765d04328dd6cae84a5fadb7371317b14c6ec",
  "gmoney-talks-9dcc-iteration-04-black-box-release": "0xb6a1f823c2ae46c63e1f0262bd6a0e473fa52f37",
  "blvck-svm": "0x1ff6ccfd3b48aa1711f40aef2b7dd0134bc15d2d",
}

// NFT Collections that provide access to all content
const MEMBERSHIP_CONTRACTS = [
  {
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!, // Main Knead Membership
    name: "Knead Membership",
    type: "erc1155",
    tokenIds: {
      premium: 1, // Premium membership token ID
      freemium: 0, // Freemium membership token ID
    },
  },
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72", // Breadwinner's Club
    name: "Breadwinner's Club Membership",
    type: "erc721",
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13", // 2025 Annual + Shift Meal
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: {
      annual: 1, // 2025 Annual token ID
      shift: 2, // Shift Meal token ID
    },
  },
]

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
        setCanAccess(true)
        setIsLoading(false)
        return
      }
      
      // Then check for single-story passes
      const singleStoryContract = SINGLE_STORY_PASSES[contentId]
      if (singleStoryContract) {
        try {
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
            setCanAccess(true)
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error(`Error checking single-story pass:`, error)
        }
      }

      // If user has freemium membership, check article count
      if (hasAccess("freemium")) {
        await checkFreemiumLimit()
      } else {
        setCanAccess(false)
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error checking access:", error)
      setError("Failed to verify your access. Please try again.")
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
        
        // If user hasn't reached limit, record this view
        if ((result.reads || 0) < 3) {
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
            setCanAccess(false)
          }
        } else {
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
    }
  }

  const handleSubscribe = () => {
    setShowSubscriptionFlow(true)
  }

  const handleSubscriptionSuccess = () => {
    setShowSubscriptionFlow(false)
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

  // No wallet connected or no freemium access
  if (!account?.address || !hasAccess("freemium")) {
    return <Paywall onSubscribe={handleSubscribe} />
  }

  // User has freemium but reached article limit
  if (canAccess === false && hasAccess("freemium") && articleCount >= 3) {
    return (
      <div className="paywall">
        <h2 className="font-adonis text-2xl mb-4">You've reached your monthly limit</h2>
        <p className="font-georgia-pro mb-6">
          You've read 3 articles this month. Subscribe to Knead Monthly for unlimited access.
        </p>
        <button 
          onClick={handleSubscribe}
          className="px-6 py-3 bg-black text-white rounded hover:bg-gray-800 font-adonis"
        >
          Subscribe Now
        </button>
      </div>
    )
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
