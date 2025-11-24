/** @type {import('next').NextConfig} */
const nextConfig = {
  // We keep these settings as they are important for your build process
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
p  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // This is required for the Towns SDK to work correctly.
  transpilePackages: [
    '@towns-protocol/react-sdk',
    '@towns-protocol/sdk',
    '@towns-protocol/web3',
    '@towns-protocol/generated'
  ],
  // Your image remote patterns are correct and should be kept.
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
    // unoptimized: true, // It's better to let Next.js optimize images if possible. Remove this if not needed.
  },
  // The headers section has been REMOVED to prevent conflict with middleware.ts
}

export default nextConfig
