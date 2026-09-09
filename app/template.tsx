'use client';

import { usePathname } from 'next/navigation';
import { Footer } from "@/components/footer";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Full-bleed surfaces that own the whole viewport and end on their own terms:
  // the site footer under them is either unreachable or plain wrong (the deck
  // at /ai-3720-build would print it as a fifteenth page).
  const hideFooter =
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/open-source') ||
    pathname?.startsWith('/ai-3720-build');

  return (
    <>
      {children}
      {!hideFooter && <Footer />}
    </>
  );
}
