// lib/viem-to-ethers.ts
import { type Account, type Chain, type Client, type Transport } from 'viem'
import { type Signer } from 'ethers-v5'
import { ethers } from 'ethers-v5'

export function walletClientToSigner(client: Client<Transport, Chain, Account>): Signer {
  const { account, chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new ethers.providers.Web3Provider(transport, network)
  const signer = provider.getSigner(account.address)
  return signer
}
