"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useActiveAccount } from "thirdweb/react"
import { createThirdwebClient, getContract } from "thirdweb"
import { balanceOf } from "thirdweb/extensions/erc1155"
import { balanceOf as erc721BalanceOf } from "thirdweb/extensions/erc721"
import { base } from "thirdweb/chains"
import Paywall from "./paywall"
import SubscriptionFlow from "./SubscriptionFlow";
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
  const { membershipType, isLoading, walletAddress, hasAccess } = useMembership()
  const [canAccess, setCanAccess] = useState(false)
  const [showStripeSubscription, setShowStripeSubscription] = useState(false)
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    if (!account?.address) {
      setCanAccess(false)
      return
    }

    checkAccess(account.address)
  }, [account?.address, contentId])

  const checkAccess = async (walletAddress: string) => {
    console.log("Checking access for wallet:", walletAddress)

    try {
      // First check if user has a single-story pass for this specific story
      const singleStoryContract = SINGLE_STORY_PASSES[contentId]
      if (singleStoryContract) {
        console.log(`Checking single-story pass for ${contentId}: ${singleStoryContract}`)

        try {
          const contractInstance = getContract({
            client,
            chain: base,
            address: singleStoryContract,
          })

          const balance = await erc721BalanceOf({
            contract: contractInstance,
            owner: walletAddress,
          })

          if (balance > 0n) {
            console.log("Single-story pass access granted!")
            setCanAccess(true)
            return
          }
        } catch (error) {
          console.error(`Error checking single-story pass for ${contentId}:`, error)
        }
      }

      // Check all membership contracts for access
      for (const contract of MEMBERSHIP_CONTRACTS) {
        console.log(`Checking contract: ${contract.name} (${contract.address})`)

        const contractInstance = getContract({
          client,
          chain: base,
          address: contract.address,
        })

        if (contract.type === "erc1155") {
          // For ERC1155 contracts, check specific token IDs
          if (contract.tokenIds) {
            // Check premium access first
            if (contract.tokenIds.premium !== undefined) {
              try {
                const premiumBalance = await balanceOf({
                  contract: contractInstance,
                  owner: walletAddress,
                  tokenId: BigInt(contract.tokenIds.premium),
                })
                console.log(`Premium balance for ${contract.name}:`, premiumBalance.toString())

                if (premiumBalance > 0n) {
                  console.log("Premium access granted!")
                  setCanAccess(true)
                  return
                }
              } catch (error) {
                console.error(`Error checking premium balance for ${contract.name}:`, error)
              }
            }

            // Check other token IDs (annual, shift, etc.)
            for (const [tokenType, tokenId] of Object.entries(contract.tokenIds)) {
              if (tokenType !== "premium" && tokenType !== "freemium") {
                try {
                  const balance = await balanceOf({
                    contract: contractInstance,
                    owner: walletAddress,
                    tokenId: BigInt(tokenId),
                  })
                  console.log(`${tokenType} balance for ${contract.name}:`, balance.toString())

                  if (balance > 0n) {
                    console.log(`Premium access granted via ${tokenType}!`)
                    setCanAccess(true)
                    return
                  }
                } catch (error) {
                  console.error(`Error checking ${tokenType} balance for ${contract.name}:`, error)
                }
              }
            }

            // Check freemium access last
            if (contract.tokenIds.freemium !== undefined) {
              try {
                const freemiumBalance = await balanceOf({
                  contract: contractInstance,
                  owner: walletAddress,
                  tokenId: BigInt(contract.tokenIds.freemium),
                })
                console.log(`Freemium balance for ${contract.name}:`, freemiumBalance.toString())

                if (freemiumBalance > 0n) {
                  console.log("Freemium access found, checking limits...")
                  await checkFreemiumLimit(walletAddress)
                  return
                }
              } catch (error) {
                console.error(`Error checking freemium balance for ${contract.name}:`, error)
              }
            }
          }
        } else if (contract.type === "erc721") {
          // For ERC721 contracts, check balance
          try {
            const balance = await erc721BalanceOf({
              contract: contractInstance,
              owner: walletAddress,
            })
            console.log(`ERC721 balance for ${contract.name}:`, balance.toString())

            if (balance > 0n) {
              console.log("Premium access granted via ERC721!")
              setCanAccess(true)
              return
            }
          } catch (error) {
            console.error(`Error checking ERC721 balance for ${contract.name}:`, error)
          }
        }
      }

      // No access found
      console.log("No membership access found")
      setCanAccess(false)
    } catch (error) {
      console.error("Error checking access:", error)
      setCanAccess(false)
    }
  }

  const checkFreemiumLimit = async (walletAddress: string) => {
    try {
      const response = await fetch("/api/track-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_address: walletAddress.toLowerCase(),
          story_slug: contentId,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setCanAccess(result.success)
      } else {
        setCanAccess(false)
      }
    } catch (error) {
      console.error("Error checking freemium limit:", error)
      setCanAccess(false)
    }
  }

  const handleSubscribe = () => {
    if (account?.address) {
      // Try to get email from account or prompt for it
      setUserEmail(account.address) // You might want to get actual email here
      setShowSubscriptionFlow(true)
    }
  }

  const handleSubscriptionSuccess = () => {
    setShowSubscriptionFlow(false)
    // Refresh access check
    if (account?.address) {
      checkAccess(account.address)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!walletAddress || !hasAccess("freemium")) {
    return <Paywall />
  }

  // Show SubscriptionFlow modal if requested
if (showSubscriptionFlow && account?.address) {
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
          email={userEmail}
          user_address={account.address}
          onSuccess={handleSubscriptionSuccess}
        />
      </div>
    </div>
  );
}
  return <>{children}</>
}
