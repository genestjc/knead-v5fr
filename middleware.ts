import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' 
      https://vercel.live 
      https://va.vercel-scripts.com 
      https://js.stripe.com
      https://c.daily.co;
    style-src 'self' 'unsafe-inline' 
      https://use.typekit.net 
      https://p.typekit.net;
    img-src 'self' blob: data: 
      https://*.thirdweb.com 
      https://*.thirdwebcdn.com
      https://ipfs.thirdwebcdn.com
      https://*.ipfs.thirdwebcdn.com
      https://*.ipfs.dweb.link 
      https://*.ipfscdn.io
      https://ipfs.io 
      https://gateway.ipfs.io
      https://storage.thirdweb.com
      https://*.thirdwebstorage.com
      https://nftstorage.link
      https://*.nftstorage.link
      https://w3s.link
      https://*.w3s.link
      https://cloudflare-ipfs.com
      https://*.cloudflare-ipfs.com
      https://cdn.sanity.io
      https://vercel.com
      https://*.supabase.co
      https://fonts.gstatic.com;
    font-src 'self' data: 
      https://use.typekit.net 
      https://p.typekit.net
      https://vercel.live
      https://fonts.googleapis.com
      https://fonts.gstatic.com;
    media-src 'self' blob: data:
      https://*.daily.co
      https://*.pluot.blue
      https://*.mux.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self' https://www.coinbase.com https://*.coinbase.com;
    frame-src 'self'
      https://embedded-wallet.thirdweb.com
      https://vercel.live
      https://js.stripe.com
      https://checkout.stripe.com
      https://www.youtube.com
      https://www.youtube-nocookie.com
      https://*.daily.co
      https://wallet.coinbase.com
      https://keys.coinbase.com
      https://*.coinbase.com;
    connect-src 'self'
      https://metamask-sdk.api.cx.metamask.io
      https://mm-sdk-analytics.api.cx.metamask.io
      https://cca-lite.coinbase.com
      https://wallet.coinbase.com
      wss://wallet.coinbase.com
      https://keys.coinbase.com
      https://api.coinbase.com
      https://*.coinbase.com
      https://relay.walletconnect.org
      https://rpc.walletconnect.com
      https://*.walletconnect.com
      https://*.walletconnect.org
      https://api.web3modal.org
      https://api.web3modal.com
      https://*.web3modal.org
      https://*.web3modal.com
      wss://relay.walletconnect.org
      wss://*.pusher.com
      https://mainnet.rpc.river.build
      https://*.figment.io
      https://*.towns.com
      https://*.towns-u4.com
      https://*.river.lgns.net
      https://*.nansen.ai
      https://esm.sh
      https://unpkg.com
      https://cdn.jsdelivr.net
      wss://*.river.build
      wss://*.figment.io
      wss://*.towns.com
      wss://*.towns-u4.com
      wss://*.river.lgns.net
      https://devnet.rpc.river.build
      https://api.stripe.com
      https://checkout.stripe.com
      https://c.thirdweb.com
      https://embedded-wallet.thirdweb.com
      https://social.thirdweb.com
      https://1.rpc.thirdweb.com
      https://8453.rpc.thirdweb.com
      https://ipfs.thirdwebcdn.com
      https://*.ipfs.thirdwebcdn.com
      https://*.thirdwebcdn.com
      https://*.ipfscdn.io
      https://ipfs.io
      https://gateway.ipfs.io
      https://*.ipfs.dweb.link
      https://storage.thirdweb.com
      https://*.thirdwebstorage.com
      https://nftstorage.link
      https://*.nftstorage.link
      https://w3s.link
      https://*.w3s.link
      https://cloudflare-ipfs.com
      https://*.cloudflare-ipfs.com
      https://use.typekit.net
      https://p.typekit.net
      https://fonts.googleapis.com
      https://cdn.sanity.io
      https://*.sanity.io
      https://api.sanity.io
      https://api.thirdweb.com
      https://*.thirdweb.com
      https://*.alchemy.com
      https://base-mainnet.g.alchemy.com
      https://mainnet.base.org
      https://base.llamarpc.com
      https://*.supabase.co
      wss://*.supabase.co
      wss://*.sanity.io
      https://accounts.google.com
      https://apis.google.com
      https://c.daily.co
      https://*.daily.co
      wss://*.daily.co
      wss://*.pluot.blue
      wss://localhost:*
      https://vercel.live
      https://vercel.com
      https://va.vercel-scripts.com
      https://*.mux.com;
  `
    .replace(/\n/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  // Run the middleware (CSP) on pages and API routes, but skip Next.js static
  // assets, the image optimizer, and common static files. Without this matcher
  // the middleware executes on every JS/CSS chunk and image request too, which
  // adds an edge invocation + latency to assets that don't need a CSP.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
