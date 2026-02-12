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
              url: 'https://kneadmag.com',
              icons: ['https://kneadmag.com/favicon.ico'],
            },
            showQrModal: true,
          }),
        ]
      : []),
    coinbaseWallet({
      appName: 'Knead Magazine',
    }),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
  },
});
