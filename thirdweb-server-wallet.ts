// app/utils/thirdweb-server-wallet.ts
import { createThirdwebClient, privateKeyAccount } from "thirdweb";

// Use secretKey for backend admin actions
export const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

// Use privateKey for server wallet (admin-only contract calls)
export const serverWallet = privateKeyAccount({
  client,
  privateKey: process.env.THIRDWEB_PRIVATE_KEY!, // NEVER expose to frontend
});
