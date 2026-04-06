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
      // lru-cache (used by @towns-protocol/sdk) imports node: prefixed built-ins
      // that don't exist in the browser. Strip the prefix so resolve.fallback
      // can stub them out with empty modules.
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

      // Use alias to stub node: prefixed built-ins that resolve.fallback misses
      // (diagnostics_channel is too new for webpack's built-in core module list)
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:diagnostics_channel': false,
        'node:async_hooks': false,
        'diagnostics_channel': false,
        'async_hooks': false,
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
