import {
  type NextRequest,
  NextResponse,
} from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  response.headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval'
      https://js.stripe.com
      https://vercel.live
      https://use.typekit.net
      https://www.youtube.com
      https://www.youtube-nocookie.com
      https://platform.twitter.com
      https://www.instagram.com
      https://static.cdninstagram.com
      https://cdn.sanity.io
      https://*.sanity.io
      https://*.thirdweb.com
      *.towns.com;
    style-src 'self' 'unsafe-inline'
      https://fonts.googleapis.com
      https://use.typekit.net
      https://p.typekit.net
      https://www.instagram.com
      https://cdn.sanity.io
      https://*.sanity.io;
    img-src 'self' blob: data:
      https://cdn.sanity.io
      https://*.sanity.io
      https://lh3.googleusercontent.com
      https://vercel.com
      https://pbs.twimg.com
      https://www.instagram.com
      https://static.cdninstagram.com
      https://*.ipfscdn.io
      https://ipfs.io
      https://ethereum.org
      https://*.thirdweb.com;
    font-src 'self'
      https://fonts.gstatic.com
      https://use.typekit.net
      https://p.typekit.net;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self'
      https://js.stripe.com
      https://hooks.stripe.com
      https://checkout.stripe.com
      https://embedded-wallet.thirdweb.com
      https://*.thirdweb.com
      https://vercel.live
      https://www.youtube.com
      https://www.youtube-nocookie.com
      https://platform.twitter.com
      https://twitter.com
      https://www.instagram.com
      https://static.cdninstagram.com
      https://cdn.sanity.io
      https://*.sanity.io
      *.towns.com;
    connect-src 'self'
      https://devnet.rpc.river.build /* --- THIS IS THE FIX --- */
      https://mainnet.rpc.river.build
      *.towns.com
      https://*.towns.com
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
      ws://localhost:*
      wss://*.sanity.io;
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  
  response.headers.set(
    "Content-Security-Policy",
    cspHeader,
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe-webhook|api/webhook|api/retry-mint).*)",
  ],
};
