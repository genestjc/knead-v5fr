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
  
  // ✅ WEBPACK CONFIG — strip node: prefix so browser fallbacks apply
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Strip "node:" prefix from imports (e.g. lru-cache ESM → node:diagnostics_channel)
      // so the resolve.fallback entries below can catch them
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );

      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
        diagnostics_channel: false,
        async_hooks: false,
        events: false,
        http: false,
        https: false,
        net: false,
        path: false,
        tls: false,
        url: false,
        zlib: false,
        fs: false,
        os: false,
        util: false,
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
