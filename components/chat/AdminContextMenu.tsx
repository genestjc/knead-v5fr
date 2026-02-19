'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'sonner';
import { useAdminRedact } from '@towns-protocol/react-sdk';

interface AdminContextMenuProps {
  message: {
    id: string;
    sender: {
      id: string;
      name: string;
    };
    content: string;
  };
  channelId: string;
  spaceId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function AdminContextMenu({ 
  message, 
  channelId, 
  spaceId, 
  position, 
  onClose 
}: AdminContextMenuProps) {
  const activeAccount = useActiveAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  // ✅ CORRECT: Use useAdminRedact for admin message deletion
  const { adminRedact, isPending: isRedacting, error: redactError } = useAdminRedact(channelId);

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
      
      if (newX < 10) {
        newX = 10;
      }
      
      if (newY < 10) {
        newY = 10;
      }
      
      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  // Close on touch outside
  useEffect(() => {
    const handleTouch = () => onClose();
    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
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
      });

      const response = await fetch('/api/chat/award-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️ DELETE MESSAGE - PRE-FLIGHT CHECK');
    console.log('   Message ID:', message.id);
    console.log('   Admin address:', activeAccount?.address);
    console.log('   Channel ID:', channelId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!adminRedact) {
      console.error('❌ adminRedact function not available');
      toast.error('Delete function not available', {
        description: 'Try refreshing the page to reconnect',
      });
      return;
    }

    if (!message.id || typeof message.id !== 'string') {
      console.error('❌ Invalid message ID:', message.id);
      toast.error('Invalid message ID');
      return;
    }

    if (message.id.length !== 64 || !/^[a-f0-9]+$/.test(message.id)) {
      console.error('⚠️ Invalid event ID format');
      toast.error(`Invalid event ID format`);
      return;
    }

    if (!confirm('Delete this message from Towns Protocol?')) return;

    setIsProcessing(true);
    try {
      console.log('🔄 Calling adminRedact...');
      console.log('   Event ID:', message.id);
      
      // ✅ CORRECT: Use adminRedact from useAdminRedact hook
      await adminRedact(message.id);
      
      console.log('✅ Message redacted successfully!');
      toast.success('Message deleted from Towns Protocol');
      onClose();
      
    } catch (error: any) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ REDACT FAILED - FULL ERROR DETAILS:');
      console.error('   Error:', error);
      console.error('   Message:', error?.message);
      console.error('   Code:', error?.code);
      
      const errorMsg = error?.message?.toLowerCase() || '';
      const errorCode = error?.code;
      
      // ✅ Check for BAD_PREV_MINIBLOCK_HASH (sync issue)
      if (errorCode === 24 || errorMsg.includes('bad_prev_miniblock_hash') || errorMsg.includes('miniblock')) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🔴 DIAGNOSIS: STREAM SYNC ERROR');
        console.error('   Error Code: 24 (BAD_PREV_MINIBLOCK_HASH)');
        console.error('   Root Cause: Local stream is behind Towns nodes');
        console.error('   Solution: Wait a moment and try again');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        toast.error('⏱️ Stream Syncing', {
          description: (
            <div className="space-y-1">
              <p className="font-semibold">Channel is still syncing with Towns nodes.</p>
              <p className="text-xs">Wait 5-10 seconds and try again.</p>
              <p className="text-xs mt-2"><strong>Tip:</strong> This happens when the channel just loaded.</p>
            </div>
          ),
          duration: 8000,
        });
        return;
      }
      
      // ✅ Check for BAD_EVENT_SIGNATURE
      if (errorCode === 22 || errorMsg.includes('bad_event_signature')) {
        console.error('🔴 DIAGNOSIS: SIGNATURE ERROR');
        toast.error('🔐 Signature Error', {
          description: 'Unexpected signature error. Refresh the page and try again.',
          duration: 8000,
        });
        return;
      }
      
      // ✅ ConnectError
      if (error?.name === 'ConnectError' || errorMsg.includes('connecterror')) {
        if (errorMsg.includes('forwarding disabled')) {
          toast.error('🔐 Session Expired', {
            description: 'Refresh the page to reconnect.',
            duration: 8000,
          });
        } else {
          toast.error('🌐 Connection Error', {
            description: 'Network issue. Try refreshing.',
            duration: 6000,
          });
        }
        return;
      }
      
      // ✅ Permission errors
      if (errorMsg.includes('permission') || errorMsg.includes('unauthorized') || errorMsg.includes('not entitled')) {
        toast.error('❌ Permission Denied', {
          description: 'You don\'t have permission to delete messages.',
          duration: 8000,
        });
        return;
      }
      
      // ✅ Generic fallback
      toast.error('Failed to delete message', {
        description: errorMsg.substring(0, 150) || 'Check console for details.',
        duration: 6000,
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBanUser = async () => {
    if (!confirm(`Ban ${message.sender.name}? They will be banned from the chat.`)) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress: activeAccount?.address,
          userAddress: message.sender.id,
          ban: true,
          spaceId: spaceId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${message.sender.name} has been banned`);
        onClose();
      } else {
        toast.error(data.error || 'Failed to ban user');
      }
    } catch (error: any) {
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
        {/* Header */}
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-georgia-pro text-gray-600">
            Admin Actions
          </p>
        </div>

        {/* Award Bonus Section */}
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
              onClick={() => handleAwardBonus(option.amount, option.type)}
              disabled={isProcessing}
              className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
            >
              <span>🎁</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Moderation Section */}
        <div className="py-1">
          <button
            onClick={handleDeleteMessage}
            disabled={isProcessing || isRedacting}
            className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-yellow-50 active:bg-yellow-100 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
          >
            <span>🗑️</span>
            <span>{isRedacting ? 'Deleting...' : 'Delete Message'}</span>
          </button>
          
          <button
            onClick={handleBanUser}
            disabled={isProcessing}
            className="w-full px-3 py-3 text-left text-sm font-georgia-pro hover:bg-red-50 active:bg-red-100 text-red-600 transition disabled:opacity-50 flex items-center gap-2 touch-manipulation"
          >
            <span>🚫</span>
            <span>Ban User</span>
          </button>
        </div>

        {/* Processing indicator */}
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
