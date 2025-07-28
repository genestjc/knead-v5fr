import {
  type NextRequest,
  NextResponse,
} from "next/server";

const SANITY_DOMAINS = [
  "https://cdn.sanity.io",
  "https://*.sanity.io",
  "https://api.sanity.io",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow CORS for API and Studio routes
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/studio")
  ) {
    const response = NextResponse.next();

    // Allow your domains and Sanity domains for CORS
    response.headers.set(
      "Access-Control-Allow-Origin",
      "*",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: response.headers,
      });
    }

    return response;
  }

  // Content Security Policy for all routes (including /studio)
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'
      https://js.stripe.com
      https://vercel.live
      https://use.typekit.net
      https://www.youtube.com
      https://www.youtube-nocookie.com
      https://platform.twitter.com
      https://www.instagram.com
      https://static.cdninstagram.com
      https://cdn.sanity.io
      https://*.sanity.io;
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
      https://static.cdninstagram.com;
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
      https://vercel.live
      https://www.youtube.com
      https://www.youtube-nocookie.com
      https://platform.twitter.com
      https://twitter.com
      https://www.instagram.com
      https://static.cdninstagram.com
      https://cdn.sanity.io
      https://*.sanity.io;
    connect-src 'self'
      https://api.stripe.com
      https://checkout.stripe.com
      https://c.thirdweb.com
      https://embedded-wallet.thirdweb.com
      https://social.thirdweb.com
      https://1.rpc.thirdweb.com
      https://8453.rpc.thirdweb.com
      https://use.typekit.net
      https://fonts.googleapis.com
      https://cdn.sanity.io
      https://*.sanity.io
      https://api.sanity.io
      ws://localhost:*
      wss://*.sanity.io;
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const response = NextResponse.next();
  response.headers.set(
    "Content-Security-Policy",
    cspHeader,
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
