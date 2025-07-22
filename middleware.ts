import {
  type NextRequest,
  NextResponse,
} from "next/server";

export function middleware(request: NextRequest) {
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();

    // Add CORS headers
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

  // Add Content Security Policy for all routes
  const response = NextResponse.next();

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://vercel.live https://use.typekit.net;
    style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net;
    img-src 'self' blob: data: https://cdn.sanity.io https://lh3.googleusercontent.com;
    font-src 'self' https://use.typekit.net https://p.typekit.net;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://embedded-wallet.thirdweb.com https://vercel.live;
    connect-src 'self' https://api.stripe.com https://c.thirdweb.com https://embedded-wallet.thirdweb.com https://social.thirdweb.com https://1.rpc.thirdweb.com https://8453.rpc.thirdweb.com;
    upgrade-insecure-requests;
  `;

  response.headers.set(
    "Content-Security-Policy",
    cspHeader.replace(/\s{2,}/g, " ").trim(),
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
