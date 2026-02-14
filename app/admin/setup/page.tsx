'use client';

import { useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import dynamicImport from 'next/dynamic';

export const dynamic = 'force-dynamic';

// Dynamically import with ssr: false to prevent prerendering
const AdminSetupContent = dynamicImport(() => import('./AdminSetupContent'), {
  ssr: false,
  loading: () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-center p-12">
        <span className="animate-spin text-4xl">⏳</span>
        <span className="ml-4 font-georgia-pro text-lg">Loading setup...</span>
      </div>
    </div>
  ),
});

let cachedClient: ReturnType<typeof createThirdwebClient> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    });
  }
  return cachedClient;
}

export default function AdminSetupPage() {
  const account = useActiveAccount();
  const client = getClient();
  const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-adonis text-4xl mb-4">Admin Setup</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-6">
            Connect your Space Owner wallet to continue
          </p>
          <ConnectButton client={client} theme="light" />
        </div>
      </div>
    );
  }

  if (account.address.toLowerCase() !== MASTER_ADMIN_ADDRESS.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="font-adonis text-4xl mb-4 text-red-600">Access Denied</h1>
          <p className="font-georgia-pro text-lg text-gray-600">
            Only the Space Owner wallet can access this page.
          </p>
          <p className="font-mono text-sm text-gray-400 mt-4">
            Connected: {account.address}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <AdminSetupContent />
    </div>
  );
}
