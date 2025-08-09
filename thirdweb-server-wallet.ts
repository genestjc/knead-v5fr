import { createThirdwebClient } from "thirdweb";
import { privateKeyAccount } from "thirdweb/wallets";
import { getBalance } from "thirdweb/extensions/general";
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

(async () => {
  try {
    console.log(
      "✅ Server wallet initialized with address:",
      serverWallet.address,
    );

    if (process.env.NODE_ENV !== "production") {
      const balance = await getBalance({
        client,
        account: serverWallet,
        chain: base,
      });
      console.log(
        `💰 Server wallet balance: ${balance.displayValue} ${balance.symbol}`,
      );
      if (balance.value < 5_000_000_000_000_000n) {
        console.warn(
          "⚠️ WARNING: Server wallet has low balance for gas fees",
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
