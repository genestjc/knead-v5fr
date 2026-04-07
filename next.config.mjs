import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  webpack: (config, { isServer, webpack }) => {
    // lru-cache v11 uses top-level await in its ESM bundle.
    // Without this, webpack cascades the async module up through the Towns SDK,
    // making TownsSyncProvider arrive as a promise instead of a component → React #306 crash.
    config.experiments = { ...config.experiments, topLevelAwait: true };

    // Route React Native async-storage to a localStorage stub on both server and client.
    // MetaMask SDK pulls this in via @wagmi/connectors — it actively calls getItem/setItem
    // so aliasing to false (empty module) crashes the app at runtime.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': resolve(__dirname, './stubs/async-storage.js'),
    };

    if (!isServer) {
      // Strip node: prefix from ESM imports (e.g. node:diagnostics_channel → diagnostics_channel)
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );

      // diagnostics_channel is used by lru-cache for optional tracing only.
      // lru-cache wraps the import in .catch() so a stub is safe.
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': resolve(__dirname, './stubs/async-storage.js'),
        'diagnostics_channel': false,
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
