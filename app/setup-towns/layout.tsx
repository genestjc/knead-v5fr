'use client';

import { ReactNode } from 'react';

// Simple passthrough - no provider here since we'll add it in the page itself
export default function SetupTownsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
