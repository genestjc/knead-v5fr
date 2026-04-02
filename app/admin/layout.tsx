'use client';

import { TownsSyncProvider } from '@towns-protocol/react-sdk';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TownsSyncProvider>
      {children}
    </TownsSyncProvider>
  );
}
