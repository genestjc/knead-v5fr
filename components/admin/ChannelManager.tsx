'use client';

import dynamicImport from 'next/dynamic';

const ChannelManagerContent = dynamicImport(() => import('./ChannelManagerContent'), {
  ssr: false,
  loading: () => (
    <div className="p-8 text-center">
      <span className="animate-spin text-2xl">⏳</span>
      <p className="mt-2 font-georgia-pro text-gray-600">Loading channel manager...</p>
    </div>
  ),
});

interface ChannelManagerProps {
  adminAddress: string;
}

export function ChannelManager({ adminAddress }: ChannelManagerProps) {
  return <ChannelManagerContent />;
}
