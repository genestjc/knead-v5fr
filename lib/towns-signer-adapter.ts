import type { Account } from "thirdweb/wallets";
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";
import { ethers5Adapter } from "thirdweb/adapters/ethers5";
import type { Signer } from "ethers";

/**
 * Creates an ethers v5 Signer from a ThirdWeb Account.
 *
 * Uses the official ThirdWeb adapter which handles RPC connection,
 * retries, and rate limiting internally.
 */
export async function createTownsSigner(
  account: Account,
  client: ThirdwebClient,
  chain: Chain,
): Promise<Signer> {
  return ethers5Adapter.signer.toEthers({ client, chain, account });
}
