import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";

// Use a fallback clientId for local/dev, but prefer the env var in production
const clientId =
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
  "44984f2bc038cebc6138d4ceb602c35d";

if (!clientId) {
  throw new Error(
    "NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set",
  );
}

export const client = createThirdwebClient({ clientId });

// New Knead Membership Contract (Soulbound ERC1155)
export const KNEAD_MEMBERSHIP_CONTRACT = {
  address: "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  name: "Knead Membership",
  type: "erc1155",
  tokenIds: {
    freemium: 0,
    premium: 1,
  },
};

// Legacy NFT Collections that also provide access to all content
export const LEGACY_MEMBERSHIP_CONTRACTS = [
  {
    address: "0x0e70AB324E8761E97F131Eecc4Dd63dFDE33cB72",
    name: "Breadwinner's Club Membership",
    type: "erc721",
  },
  {
    address: "0xa4b1aF8cffEE71D71721cB69596C9A31ac449F13",
    name: "2025 Annual + Shift Meal Membership",
    type: "erc1155",
    tokenIds: {
      annual: 1,
      shift: 2,
    },
  },
];

// Story-specific NFT collections for individual story access
export const STORY_COLLECTIONS: Record<string, string[]> = {
  "blvck-svm-michelinman-dinner": [
    // Add story-specific contract addresses here when available
  ],
};

export const CHAIN = base;
