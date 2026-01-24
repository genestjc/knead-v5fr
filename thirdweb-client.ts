import { createThirdwebClient, getNativeBalance } from "thirdweb";
import { base } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { getContract } from "thirdweb";
import { logger } from "./lib/logger";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (process.env.NODE_ENV !== 'production') {
  if (!clientId) {
    logger.warn("⚠️ WARNING: NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set!");
    logger.warn("ThirdWeb functionality may be limited. Check your .env file.");
  } else {
    logger.log("✅ ThirdWeb client ID configured correctly");
  }
}

export const client = createThirdwebClient({ 
  clientId: clientId || (() => {
    throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_ID is required');
  })()
});

export const activeChain = base;

logger.log(`ThirdWeb client initialized (${typeof window === 'undefined' ? 'server' : 'client'} side)`);

export const KNEAD_MEMBERSHIP_CONTRACT = {
  address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85",
  name: "Knead Membership",
  type: "erc1155",
  tokenIds: {
    freemium: 0,
    premium: 1,
  },
};
