// lib/thirdweb/treasury.ts - Use Engine like your other routes

import { createThirdwebClient, getContract, prepareContractCall, readContract, Engine } from "thirdweb";
import { base } from "thirdweb/chains";
import type { Address } from "thirdweb";

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

const serverWallet = Engine.serverWallet({
  client,
  address: process.env.ENGINE_SERVER_WALLET_ADDRESS,
  vaultAccessToken: process.env.ENGINE_VAULT_ACCESS_TOKEN,
});

export const TREASURY_WALLET_ADDRESS = process.env.ENGINE_SERVER_WALLET_ADDRESS!;

export function getTreasuryAddress(): string {
  return TREASURY_WALLET_ADDRESS;
}

export async function sendTownsTokens(
  recipientAddress: Address,
  amount: string,
): Promise<{ transactionHash: string }> {
  const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
  if (!townsContractAddress) {
    throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
  }

  const contract = getContract({
    client,
    address: townsContractAddress as Address,
    chain: base,
  });

  const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));

  const transaction = prepareContractCall({
    contract,
    method: "function transfer(address to, uint256 amount) returns (bool)",
    params: [recipientAddress, amountInWei],
  });

  // ✅ Same pattern as your mint routes
  const { transactionId } = await serverWallet.enqueueTransaction({
    transaction,
  });

  const { transactionHash } = await Engine.waitForTransactionHash({
    client,
    transactionId,
  });

  return { transactionHash };
}

export async function getTreasuryBalance(): Promise<string> {
  const townsContractAddress = process.env.NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS;
  if (!townsContractAddress) {
    throw new Error("NEXT_PUBLIC_TOWNS_CONTRACT_ADDRESS is not set");
  }

  const contract = getContract({
    client,
    address: townsContractAddress as Address,
    chain: base,
  });

  const balance = await readContract({
    contract,
    method: "function balanceOf(address account) view returns (uint256)",
    params: [TREASURY_WALLET_ADDRESS as Address],
  });

  const balanceInTokens = Number(balance) / 1e18;
  return balanceInTokens.toFixed(8);
}
