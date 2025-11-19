import "dotenv/config";
import {
  createThirdwebClient,
  Engine,
  getContract,
  prepareContractCall,
} from "thirdweb";
import { base } from "thirdweb/chains";

async function main() {
  const client = createThirdwebClient({
    secretKey: process.env.THIRDWEB_SECRET_KEY!,
  });
  const serverWallet = Engine.serverWallet({
    client,
    address: process.env.ENGINE_SERVER_WALLET_ADDRESS!,
    vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN!,
  });

  const contract = getContract({
    client,
    address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    chain: base,
  });

  const transaction = prepareContractCall({
    contract,
    method: "function transferOwnership(address newOwner)",
    params: [process.env.NEW_OWNER_ADDRESS!],
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });
  console.log("Transaction enqueued. Waiting for hash...");

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  console.log("✅ Ownership transferred! Tx hash:", transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
