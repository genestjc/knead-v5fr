'use client';

import { usePathname } from 'next/navigation';
import { Footer } from "@/components/footer";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter = pathname?.startsWith('/chat-test');

  return (
    <>
      {children}
      {!hideFooter && <Footer />}
    </>
  );
}
