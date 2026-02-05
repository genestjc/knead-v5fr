import {
  type NextRequest,
  NextResponse,
} from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  // HSTS - only in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  
  // ✅ FIX: Use unsafe-none ONLY for /chat-test
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/chat-test')) {
    response.headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  } else {
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  }
  
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
      https://esm.sh
      https://unpkg.com
      https://cdn.jsdelivr.net
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
    frame-ancestors 'self' https://*.thirdweb.com https://embedded-wallet.thirdweb.com;
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
      https://devnet.rpc.river.build
      https://mainnet.rpc.river.build
      https://*.figment.io
      https://*.towns.com
      https://*.towns-u4.com
      https://*.river.lgns.net
      https://*.nansen.ai
      https://esm.sh
      https://unpkg.com
      https://cdn.jsdelivr.net
      wss://*.figment.io
      wss://*.towns.com
      wss://*.towns-u4.com
      wss://*.river.lgns.net
      wss://*.nansen.ai
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
      https://base-mainnet.g.alchemy.com/v2/w8-f4Y2PxFDqBK33ltv9s
      https://*.alchemy.com
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
