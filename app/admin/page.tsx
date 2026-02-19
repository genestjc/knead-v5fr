import { MonthlyMintManager } from '@/components/admin/MonthlyMintManager';

const [activeTab, setActiveTab] = useState<'events' | 'contributors' | 'users' | 'mint'>('events');

<button 
  onClick={() => setActiveTab('mint')} 
  className={`py-4 px-1 border-b-2 font-georgia-pro text-sm font-medium transition ${
    activeTab === 'mint' 
      ? 'border-black text-black' 
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`}
>
  🎫 Monthly Mint
</button>

{activeTab === 'mint' && <MonthlyMintManager adminAddress={account.address} />}