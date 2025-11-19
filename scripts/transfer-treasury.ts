import "dotenv/config";
import {
  createThirdwebClient,
  Engine,
  getContract,
  prepareContractCall,
  toWei,
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
    address: process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS!,
    chain: base,
  });

  const amount = toWei(process.env.TREASURY_TRANSFER_AMOUNT!);

  const transaction = prepareContractCall({
    contract,
    method: "function transfer(address to, uint256 amount) returns (bool)",
    params: [process.env.TREASURY_RECIPIENT_ADDRESS!, amount],
  });

  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });
  console.log("Treasury transfer enqueued. Waiting for hash...");

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  console.log("✅ Treasury funds transferred! Tx hash:", transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
