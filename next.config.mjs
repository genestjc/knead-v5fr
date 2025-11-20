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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.stripe.com https://js.stripe.com;
              style-src 'self' 'unsafe-inline' https://use.typekit.net https://fonts.googleapis.com;
              font-src 'self' https://use.typekit.net https://fonts.gstatic.com data:;
              img-src 'self' https://*.sanity.io https://cdn.sanity.io https://lh3.googleusercontent.com https://p.typekit.net https://use.typekit.net data: blob:;
              connect-src 'self' 
                https://api.stripe.com 
                https://checkout.stripe.com 
                https://c.thirdweb.com 
                https://embedded-wallet.thirdweb.com 
                https://social.thirdweb.com 
                https://1.rpc.thirdweb.com 
                https://8453.rpc.thirdweb.com 
                https://*.ipfscdn.io 
                https://ipfs.io 
                https://use.typekit.net 
                https://fonts.googleapis.com 
                https://cdn.sanity.io 
                https://*.sanity.io 
                https://api.sanity.io 
                https://api.thirdweb.com 
                https://*.thirdweb.com
                https://mainnet.base.org
                https://base-mainnet.g.alchemy.com
                https://base.llamarpc.com
                https://*.supabase.co
                wss://*.sanity.io 
                ws://localhost:*;
              frame-src 'self' https://checkout.stripe.com https://js.stripe.com https://verify.walletconnect.com https://verify.walletconnect.org https://*.sanity.io;
              worker-src 'self' blob:;
            `.replace(/\s+/g, ' ').trim(),
          },
        ],
      },
    ];
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
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ]
  },
}

export default nextConfig
