import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    // Domain ownership is verified via the base:app_id meta tag in layout.tsx.
    accountAssociation: {},
    frame: {
      version: '1',
      name: 'Knead',
      homeUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.kneadmag.com',
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.kneadmag.com'}/api/webhook`,
      iconUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.kneadmag.com'}/favicon.ico`,
      splashImageUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.kneadmag.com'}/placeholder-logo.png`,
      splashBackgroundColor: '#ffffff',
    },
  });
}
