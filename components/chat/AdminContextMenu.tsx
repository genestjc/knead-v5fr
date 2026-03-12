'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'sonner';
import { useAdminRedact, useSyncAgent } from '@towns-protocol/react-sdk';

import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { client, activeChain } from '@/thirdweb-client';

interface AdminContextMenuProps {
  message: {
    id: string;
    sender: {
      id: string;
      name: string;
    };
    content: string;
  };
  eventId?: number;
  channelId: string;
  spaceId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function AdminContextMenu({ 
  message, 
  eventId, 
  channelId, 
  spaceId, 
  position, 
  onClose 
}: AdminContextMenuProps) {
  const activeAccount = useActiveAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  const { adminRedact, isPending: isRedacting } = useAdminRedact(channelId);
  const sync = useSyncAgent();

  // Adjust position to prevent off-screen menu
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = position.x;
      let newY = position.y;
      
      if (newX + menuRect.width > viewportWidth - 10) {
        newX = viewportWidth - menuRect.width - 10;
      }
      
      if (newY + menuRect.height > viewportHeight - 10) {
        newY = viewportHeight - menuRect.height - 10;
      }
      
      if (newX < 10) newX = 10;
      if (newY < 10) newY = 10;
      
      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position]);

  // ✅ Close only on click OUTSIDE the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  // ✅ Close only on touch OUTSIDE the menu
  useEffect(() => {
    const handleTouchOutside = (event: TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    const timer = setTimeout(() => {
      document.addEventListener('touchstart', handleTouchOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAwardBonus = async (amount: number, bonusType: string) => {
    if (!activeAccount?.address) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🎁 Awarding bonus:', {
        admin: activeAccount.address,
        participant: message.sender.id,
        amount,
        bonusType,
        eventId,
      });

      const response = await fetch('/api/chat/award-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress: activeAccount.address,
          eventId,
          participantAddress: message.sender.id,
          bonusAmount: amount,
          bonusType,
        }),
      });

      const data = await response.json();
      console.log('📬 API Response:', data);

      if (data.success) {
        toast.success(`Awarded ${amount} TOWNS bonus!`, {
          description: `TX: ${data.transactionHash?.slice(0, 10)}...`,
        });
        
        // ✅ Enhanced event with participantAddress and bonusAmount for optimistic updates
        window.dispatchEvent(new CustomEvent('message-tipped', { 
          detail: { 
            messageId: message.id,
            participantAddress: message.sender.id,
            bonusAmount: amount,
          } 
        }));
        
        onClose();
      } else {
        console.error('❌ API Error:', data);
        toast.error(data.error || 'Failed to award bonus', {
          description: data.details,
        });
      }
    } catch (error: any) {
      console.error('❌ Catch Error:', error);
      toast.error(error.message || 'Failed to award bonus');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMessage = async () => {
    console.log('🗑️ DELETE MESSAGE - START');

    if (!adminRedact) {
      console.error('❌ adminRedact function not available');
      toast.error('Delete function not available', {
        description: 'Try refreshing the page to reconnect',
      });
      return;
    }

    if (!message.id || typeof message.id !== 'string' || message.id.length !== 64 || !/^[a-f0-9]+$/.test(message.id)) {
      console.error('⚠️ Invalid message ID');
      toast.error('Invalid message ID format');
      return;
    }

    if (!confirm('Delete this message from Towns Protocol?')) return;

    setIsProcessing(true);
    try {
      console.log('🔄 Calling adminRedact...');
      await adminRedact(message.id);
      
      console.log('✅ Message redacted successfully!');
      toast.success('Message deleted from Towns Protocol');
      onClose();
      
    } catch (error: any) {
      console.error('❌ REDACT FAILED:', error);
      
      const errorMsg = error?.message?.toLowerCase() || '';
      const errorCode = error?.code;
      
      if (errorCode === 24 || errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
        toast.error('⏱️ Stream Syncing', {
          description: 'Channel is still syncing. Wait 5-10 seconds and try again.',
          duration: 8000,
        });
      } else if (errorCode === 22 || errorMsg.includes('bad_event_signature')) {
        toast.error('🔐 Signature Error', {
          description: 'Refresh the page and try again.',
          duration: 8000,
        });
      } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized') || errorMsg.includes('not entitled')) {
        toast.error('❌ Permission Denied', {
          description: 'You don\'t have permission to delete messages.',
          duration: 8000,
        });
      } else {
        toast.error('Failed to delete message', {
          description: errorMsg.substring(0, 150) || 'Check console for details.',
          duration: 6000,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBanUser = async () => {
    console.log('🚫 BAN USER - START');

    if (!confirm(`Ban ${message.sender.name}? They will be banned from the chat.`)) return;

    if (!activeAccount) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!sync) {
      console.error('❌ Sync agent not available');
      toast.error('Connection error', {
        description: 'Towns sync agent not loaded. Try refreshing.',
        duration: 6000,
      });
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🔄 Step 1: On-chain ban via Towns Protocol...');
      
      try {
        const signer = await createTownsSigner(activeAccount, client, activeChain);
        console.log('✅ Signer created');
        
        const tx = await Promise.race([
          sync.riverConnection.spaceDapp.banWalletAddress(spaceId, message.sender.id, signer),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout after 60s')), 60000)),
        ]) as any;
        
        console.log('✅ Transaction submitted:', tx.hash);
        
        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout after 120s')), 120000)),
        ]) as any;
        
        console.log('✅ On-chain ban confirmed:', receipt.transactionHash);
        
      } catch (onChainError: any) {
        console.error('❌ On-chain ban failed:', onChainError);
        
        const errorMsg = onChainError?.message?.toLowerCase() || '';
        
        if (errorMsg.includes('timeout')) {
          toast.error('⏱️ Transaction Timeout', {
            description: 'The blockchain transaction took too long. Please try again.',
            duration: 8000,
          });
        } else if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
          toast.error('❌ Transaction Cancelled', {
            description: 'You cancelled the transaction.',
            duration: 6000,
          });
        } else if (errorMsg.includes('permission') || errorMsg.includes('not entitled') || errorMsg.includes('unauthorized')) {
          toast.error('❌ Permission Denied', {
            description: 'You don\'t have ModifyBanning permission. Contact master admin.',
            duration: 8000,
          });
        } else {
          toast.error('On-chain ban failed', {
            description: onChainError.message?.substring(0, 150) || 'Transaction could not be submitted.',
            duration: 8000,
          });
        }
        return;
      }

      console.log('🔄 Step 2: Updating Supabase...');
      
      const response = await fetch('/api/admin/ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress: activeAccount.address,
          userAddress: message.sender.id,
          ban: true,
          spaceId: spaceId,
        }),
      });

      const data = await response.json();
      console.log('📬 Supabase response:', data);

      if (data.success) {
        console.log('✅ BAN COMPLETE');
        toast.success(`${message.sender.name} has been banned`, {
          description: 'User is now banned from the chat.',
          duration: 6000,
        });
        onClose();
      } else {
        console.error('❌ Supabase update failed:', data);
        toast.error(data.error || 'Failed to update ban status in database');
      }
    } catch (error: any) {
      console.error('❌ BAN FAILED:', error);
      toast.error(error.message || 'Failed to ban user');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden min-w-[220px] max-w-[90vw]"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-georgia-pro text-gray-600">Admin Actions</p>
        </div>

        <div className="py-1">
          <p className="px-3 py-2 text-xs font-georgia-pro text-gray-500 uppercase tracking-wide">
            Award Bonus
          </p>
          {[
            { amount: 5, label: 'Good (5 TOWNS)', type: 'good_contribution' },
            { amount: 10, label: 'Great (10 TOWNS)', type: 'great_contribution' },
            { amount: 15, label: 'Excellent (15 TOWNS)', type: 'excellent_contribution' },
            { amount: 20, label: 'Outstanding (20 TOWNS)', type: 'outstanding_contribution' },
          ].map((option) => (
            <button
              key={option.amount}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAwardBonus(option.amount, option.type);
              }}
              disabled={isProcessing}
              className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
            >
              <span>🎁</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-200"></div>

        <div className="py-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteMessage();
            }}
            disabled={isProcessing || isRedacting}
            className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-yellow-50 active:bg-yellow-100 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
          >
            <span>🗑️</span>
            <span>{isRedacting ? 'Deleting...' : 'Delete Message'}</span>
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBanUser();
            }}
            disabled={isProcessing}
            className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-red-50 active:bg-red-100 text-red-600 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
          >
            <span>🚫</span>
            <span>Ban User</span>
          </button>
        </div>

        {(isProcessing || isRedacting) && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
            <p className="text-xs font-georgia-pro text-gray-600 flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Processing...
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
