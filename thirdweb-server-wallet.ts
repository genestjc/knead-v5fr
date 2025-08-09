import {
  createThirdwebClient,
  getBalance as getNativeBalance,
} from "thirdweb";
import { privateKeyAccount } from "thirdweb/wallets";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { base } from "thirdweb/chains";

if (
  !process.env.THIRDWEB_SECRET_KEY ||
  !process.env.THIRDWEB_PRIVATE_KEY
) {
  throw new Error(
    "❌ CRITICAL: THIRDWEB_SECRET_KEY and THIRDWEB_PRIVATE_KEY must be set!",
  );
}

export const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

export const serverWallet = privateKeyAccount({
  client,
  privateKey: process.env.THIRDWEB_PRIVATE_KEY,
});

// Your ERC1155 contract address here
const ERC1155_CONTRACT_ADDRESS =
  "YOUR_ERC1155_CONTRACT_ADDRESS";

(async () => {
  try {
    console.log(
      "✅ Server wallet initialized with address:",
      serverWallet.address,
    );

    if (process.env.NODE_ENV !== "production") {
      // 1. Check native token balance (for gas)
      const nativeBalance = await getNativeBalance({
        client,
        account: serverWallet,
        chain: base,
      });
      console.log(
        `💰 Server wallet native balance: ${nativeBalance.displayValue} ${nativeBalance.symbol}`,
      );
      if (nativeBalance.value < 5_000_000_000_000_000n) {
        console.warn(
          "⚠️ WARNING: Server wallet has low balance for gas fees",
        );
      }

      // 2. Check ERC1155 token balances
      const contract = getContract({
        client,
        address: ERC1155_CONTRACT_ADDRESS,
        chain: base,
      });

      // Check both FREEMIUM (0) and PAID (1)
      const tokenIds = [0n, 1n];
      for (const tokenId of tokenIds) {
        const erc1155Balance = await balanceOf({
          contract,
          owner: serverWallet.address,
          tokenId,
        });
        console.log(
          `🪙 ERC1155 Token ID ${tokenId} balance: ${erc1155Balance.value}`,
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Failed to properly initialize server wallet:",
      error,
    );
  }
})();
