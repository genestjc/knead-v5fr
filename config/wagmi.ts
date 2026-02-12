import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'default-project-id',
      metadata: {
        name: 'Knead Magazine',
        description: 'Nourishment for the creative spirit',
        url: 'https://kneadmag.com',
        icons: ['https://kneadmag.com/favicon.ico'],
      },
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: 'Knead Magazine',
    }),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
  },
});
