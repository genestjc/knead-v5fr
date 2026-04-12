import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// Validate WalletConnect project ID
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!walletConnectProjectId) {
  console.warn('⚠️ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will not work.');
}

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    metaMask(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: 'Knead Magazine',
              description: 'Nourishment for the creative spirit',
              url: 'https://www.kneadmag.com',
              icons: ['https://www.kneadmag.com/favicon.ico'],
            },
            showQrModal: true,
          }),
        ]
      : []),
    coinbaseWallet({
      appName: 'Knead Magazine',
      // 'all' allows both Smart Wallet (Base App) and EOA (browser) users.
      // Paymaster/gas sponsorship for Smart Wallet is configured separately
      // via Coinbase Developer Platform, not through this connector.
      preference: { options: 'all' },
    }),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
  },
});
