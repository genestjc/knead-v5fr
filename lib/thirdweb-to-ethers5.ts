// lib/thirdweb-to-ethers5.ts
import { ethers } from "ethers-v5";
import type { Wallet } from "thirdweb/wallets";
import type { Chain } from "thirdweb/chains";
import type { ThirdwebClient } from "thirdweb";

/**
 * Converts a thirdweb wallet to an ethers v5 Signer.
 */
export async function thirdwebWalletToEthersV5Signer(
  wallet: Wallet,
  client: ThirdwebClient,
  chain: Chain,
): Promise<ethers.Signer> {
  const account = wallet.getAccount();
  if (!account) throw new Error("No account connected to wallet");

  // EIP-1193 provider shim
  const provider = {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      // Handle common methods
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [account.address];
      }
      if (method === "eth_chainId") {
        return `0x${chain.id.toString(16)}`;
      }
      // Delegate signing to wallet
      if (method === "personal_sign") {
        const [message] = params || [];
        if (wallet.signMessage) return await wallet.signMessage({ message });
      }
      if (method === "eth_sign") {
        const [address, message] = params || [];
        if (wallet.signMessage) return await wallet.signMessage({ message });
      }
      if (method === "eth_signTypedData_v4") {
        const [address, typedData] = params || [];
        if (wallet.signTypedData) {
          const data = JSON.parse(typedData);
          return await wallet.signTypedData(data);
        }
      }
      if (method === "eth_sendTransaction") {
        const [tx] = params || [];
        if (wallet.sendTransaction) {
          const result = await wallet.sendTransaction(tx);
          return result.transactionHash || result.hash;
        }
      }
      // Fallback: raw RPC
      const rpcUrl = chain.rpc;
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params: params || [],
        }),
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
    on: () => {},
    removeListener: () => {},
  };

  // Wrap in ethers v5 Web3Provider
  const ethersProvider = new ethers.providers.Web3Provider(provider as any, {
    chainId: chain.id,
    name: chain.name || "Unknown",
  });

  return ethersProvider.getSigner(account.address);
}
