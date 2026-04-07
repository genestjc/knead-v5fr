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

  env: {
    BASE_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  },

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
