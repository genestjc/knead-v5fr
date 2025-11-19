import "dotenv/config";
import { createThirdwebClient, Engine, prepareTransaction } from "thirdweb";
import { base } from "thirdweb/chains";
import { parseEther } from "thirdweb";

async function main() {
  const client = createThirdwebClient({
    secretKey: process.env.THIRDWEB_SECRET_KEY!,
  });
  const serverWallet = Engine.serverWallet({
    client,
    address: process.env.ENGINE_SERVER_WALLET_ADDRESS!,
    vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN!,
  });

  const transaction = prepareTransaction({
    to: process.env.TREASURY_RECIPIENT_ADDRESS!,
    value: parseEther(process.env.TREASURY_ETH_TRANSFER_AMOUNT!),
    chain: base,
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });
  console.log("ETH transfer enqueued. Waiting for hash...");

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  console.log("✅ ETH transferred! Tx hash:", transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
