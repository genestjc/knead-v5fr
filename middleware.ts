import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' 
      https://vercel.live 
      https://va.vercel-scripts.com 
      https://js.stripe.com;
    style-src 'self' 'unsafe-inline' 
      https://use.typekit.net 
      https://p.typekit.net;
    img-src 'self' blob: data: 
      https://*.thirdweb.com 
      https://*.thirdwebcdn.com
      https://*.ipfs.dweb.link 
      https://*.ipfscdn.io
      https://ipfs.io 
      https://gateway.ipfs.io
      https://cdn.sanity.io
      https://vercel.com
      https://*.supabase.co;
    font-src 'self' data: 
      https://use.typekit.net 
      https://p.typekit.net;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' 
      https://embedded-wallet.thirdweb.com 
      https://vercel.live 
      https://js.stripe.com 
      https://checkout.stripe.com
      https://www.youtube.com
      https://www.youtube-nocookie.com;
    connect-src 'self'
      https://metamask-sdk.api.cx.metamask.io
      https://mm-sdk-analytics.api.cx.metamask.io
      https://cca-lite.coinbase.com
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
      https://devnet.rpc.river.build
      https://api.stripe.com
      https://checkout.stripe.com
      https://c.thirdweb.com
      https://embedded-wallet.thirdweb.com
      https://social.thirdweb.com
      https://1.rpc.thirdweb.com
      https://8453.rpc.thirdweb.com
      https://*.ipfscdn.io
      https://ipfs.io
      https://gateway.ipfs.io
      https://*.ipfs.dweb.link
      https://use.typekit.net
      https://p.typekit.net
      https://fonts.googleapis.com
      https://cdn.sanity.io
      https://*.sanity.io
      https://api.sanity.io
      https://api.thirdweb.com
      https://*.thirdweb.com
      https://*.thirdwebcdn.com
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
      https://va.vercel-scripts.com;
  `.replace(/\s{2,}/g, ' ').trim();

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
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
