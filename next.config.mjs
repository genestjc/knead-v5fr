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
    '@towns-protocol/generated'
  ],

  // ✅ Expose RPC URLs to browser under the keys the Towns SDK expects
  // The SDK reads process.env.BASE_MAINNET_RPC_URL (not NEXT_PUBLIC_)
  // Next.js only exposes NEXT_PUBLIC_ vars client-side, so we alias them here
  // Hardcoded fallback guarantees the value reaches the bundle even if
  // Vercel env var resolution has a timing issue at build time
  env: {
    BASE_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/w8-f4Y2PxFDqBK33ltv9s',
    VITE_BASE_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/w8-f4Y2PxFDqBK33ltv9s',
  },
  
  // ✅ WEBPACK CONFIG FOR .mjs FILES
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
      };
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
