import { createThirdwebClient } from "thirdweb";
import { privateKeyAccount } from "thirdweb/wallets";

export const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

export const serverWallet = privateKeyAccount({
  client,
  privateKey: process.env.THIRDWEB_PRIVATE_KEY!, // NEVER expose to frontend
});
