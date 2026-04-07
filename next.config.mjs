/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  transpilePackages: [
    '@towns-protocol/react-sdk',
    '@towns-protocol/sdk',
    '@towns-protocol/web3',
    '@towns-protocol/generated',
    '@mux/mux-player-react',
  ],

  // ✅ ADD THIS (uses public Base RPC):
  env: {
    BASE_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  },

  // ✅ WEBPACK CONFIG — node polyfills for Towns Protocol SDK (designed for Vite)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
      config.plugins.push(new NodePolyfillPlugin({ excludeAliases: ['console'] }));
    }
    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },

  // ✅ FIX THIRDWEB AUTHENTICATION POPUPS (COOP)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
}

export default nextConfig;
