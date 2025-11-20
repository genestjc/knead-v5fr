'use client';

import { TownsSyncProvider } from '@towns-protocol/react-sdk';

export default function SetupTownsLayout({
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
