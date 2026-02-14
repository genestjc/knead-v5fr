import dynamic from 'next/dynamic';

const ListChannelsContent = dynamic(() => import('./list-channels-content'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
        <p className="font-georgia-pro">Loading...</p>
      </div>
    </div>
  ),
});

export default function ListChannelsPage() {
  return <ListChannelsContent />;
}
