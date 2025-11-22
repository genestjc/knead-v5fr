'use client';

import { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { useRealtimeProfile } from '@/hooks/use-realtime-profile';
import { toast } from 'sonner';
// Import the thirdweb hook to get wallet details
import { useActiveWallet } from 'thirdweb/react';

export function ContributorWallet() {
  const user = useUser();
  const { profile, loading } = useRealtimeProfile(user?.id || null);
  const [isWithdrawModalOpen, setWithdrawModalOpen] = useState(false);

  if (loading || !profile || !['contributor', 'admin', 'master-admin'].includes(profile.role)) {
    return null;
  }

  const weeklyBudget = profile.remaining_weekly_budget ?? 0;
  const budgetMax = profile.distribution_budget_weekly ?? 100;
  const personalEarnings = profile.personal_earnings_total ?? 0;

  return (
    <>
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-georgia-pro text-sm font-semibold text-gray-900 dark:text-white mb-3">Your Contributor Wallet</h3>
        <div className="space-y-3">
          {/* Weekly Distribution Budget */}
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              <span>Weekly Budget</span>
              <span>{weeklyBudget.toFixed(0)} / {budgetMax} pts</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(weeklyBudget / budgetMax) * 100}%` }}></div>
            </div>
          </div>
          
          {/* Personal Earnings */}
          <div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Personal Earnings</span>
              <span className="text-base font-bold text-green-600 dark:text-green-400">{personalEarnings.toFixed(2)} pts</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your withdrawable balance.</p>
          </div>
          
          <button
            onClick={() => setWithdrawModalOpen(true)}
            disabled={personalEarnings <= 0}
            className="w-full mt-2 px-4 py-2 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw Earnings
          </button>
        </div>
      </div>
      
      {isWithdrawModalOpen && (
        <WithdrawModal 
          currentBalance={personalEarnings}
          onClose={() => setWithdrawModalOpen(false)}
        />
      )}
    </>
  );
}

// --- UPGRADED "SMART" WITHDRAWAL MODAL ---
interface WithdrawModalProps {
  currentBalance: number;
  onClose: () => void;
}

function WithdrawModal({ currentBalance, onClose }: WithdrawModalProps) {
  const user = useUser();
  const activeWallet = useActiveWallet(); // The key hook to identify the wallet type

  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Determine if the user is on an embedded wallet vs. an external one like MetaMask
  const isEmbeddedWallet = activeWallet?.id === 'inApp';
  const connectedAddress = activeWallet?.getAccount()?.address;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalRecipientAddress = isEmbeddedWallet ? recipientAddress : connectedAddress;

    if (!user || !finalRecipientAddress || !amount) {
        toast.error("Missing required information.");
        return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > currentBalance) {
      toast.error('Invalid withdrawal amount.');
      return;
    }
    
    setIsWithdrawing(true);
    try {
      const response = await fetch('/api/chat/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountPoints: amountNum,
          recipientAddress: finalRecipientAddress,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Withdrawal failed.');
      }

      toast.success(data.message || 'Withdrawal successful!');
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="font-adonis text-xl mb-4">Withdraw Your Earnings</h3>
            <p className="font-georgia-pro text-sm text-gray-600 mb-4">
                Your balance is <span className="font-bold">{currentBalance.toFixed(2)} points</span>. This will be converted to `$TOWNS` tokens and sent to your wallet.
            </p>
            <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                    <label className="block font-georgia-pro text-sm mb-1">Points to Withdraw</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={currentBalance} placeholder={`Max: ${currentBalance.toFixed(2)}`} className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro" required />
                </div>
                
                {/* --- This is the new conditional logic --- */}
                {isEmbeddedWallet ? (
                    <div>
                        <label className="block font-georgia-pro text-sm mb-1">Destination Wallet Address</label>
                        <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="0x... (your Coinbase, MetaMask, etc.)" className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro" required />
                        <p className="text-xs text-gray-500 mt-1">Since you are using an in-app wallet, please provide an external address to receive your tokens.</p>
                    </div>
                ) : (
                    <div>
                        <label className="block font-georgia-pro text-sm mb-1">Destination Wallet Address</label>
                        <input type="text" value={connectedAddress} className="w-full px-4 py-2 border bg-gray-100 border-gray-300 rounded font-georgia-pro" disabled />
                        <p className="text-xs text-gray-500 mt-1">Your connected wallet will be used for the withdrawal.</p>
                    </div>
                )}
                {/* --- End of conditional logic --- */}

                <div className="flex items-center gap-3 pt-4">
                    <button type="submit" disabled={isWithdrawing} className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50">
                        {isWithdrawing ? 'Processing...' : 'Withdraw Now'}
                    </button>
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-black rounded-full font-georgia-pro hover:bg-gray-300 transition">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
     </div>
  );
}
