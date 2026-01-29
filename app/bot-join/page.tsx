'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';

const LoadingSpinner = () => (
  <div style={{ 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: '#f9f9f9'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '2px solid #000',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 16px'
      }} />
      <p style={{ fontFamily: 'Georgia, serif', color: '#666' }}>Loading Bot Join...</p>
    </div>
  </div>
);

// Dynamically import the client component with ssr: false
const BotJoinClient = nextDynamic(() => import('./bot-join-client'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export default function BotJoinPage() {
  return <BotJoinClient />;
}
