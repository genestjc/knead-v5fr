'use client';

import { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { useRealtimeProfile } from '@/hooks/use-realtime-profile'; // The hook we created
import { toast } from 'sonner';

export function ContributorWallet() {
  const user = useUser();
  const { profile, loading } = useRealtimeProfile(user?.id || null);
  const [isWithdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // We only show this component if the user is a contributor
  if (loading || !profile || profile.role !== 'contributor') {
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
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(weeklyBudget / budgetMax) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {/* Personal Earnings */}
          <div>
            <div className="flex justify-between items-center text-xs font-medium text-gray-600 dark:text-gray-400">
              <span>Personal Earnings</span>
              <span className="text-base font-bold text-green-600 dark:text-green-400">
                {personalEarnings.toFixed(2)} pts
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">This is your withdrawable balance.</p>
          </div>
          
          <button
            onClick={() => setWithdrawModalOpen(true)}
            className="w-full mt-2 px-4 py-2 bg-black text-white rounded-full font-georgia-pro text-sm hover:bg-gray-800 transition"
          >
            Withdraw Earnings
          </button>
        </div>
      </div>
      
      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <WithdrawModal 
          currentBalance={personalEarnings}
          onClose={() => setWithdrawModalOpen(false)}
        />
      )}
    </>
  );
}

// --- Withdrawal Modal Component ---
interface WithdrawModalProps {
  currentBalance: number;
  onClose: () => void;
}

function WithdrawModal({ currentBalance, onClose }: WithdrawModalProps) {
  const user = useUser();
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recipientAddress || !amount) return;

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
          recipientAddress: recipientAddress,
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
                Your total balance is <span className="font-bold">{currentBalance.toFixed(2)} points</span>. Withdrawals will send `$TOWNS` tokens to the external wallet address you provide.
            </p>
            <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                    <label className="block font-georgia-pro text-sm mb-1">Points to Withdraw</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        max={currentBalance}
                        placeholder="e.g., 100"
                        className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                        required
                    />
                </div>
                <div>
                    <label className="block font-georgia-pro text-sm mb-1">Recipient Wallet Address</label>
                    <input
                        type="text"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="0x... (your Coinbase, MetaMask, etc. address)"
                        className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                        required
                    />
                </div>
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
