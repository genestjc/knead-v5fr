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

  // ✅ MOBILE FIX: Adjust position to prevent off-screen menu
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = position.x;
      let newY = position.y;
      
      // Prevent going off right edge
      if (newX + menuRect.width > viewportWidth - 10) {
        newX = viewportWidth - menuRect.width - 10;
      }
      
      // Prevent going off bottom edge
      if (newY + menuRect.height > viewportHeight - 10) {
        newY = viewportHeight - menuRect.height - 10;
      }
      
      // Prevent going off left edge
      if (newX < 10) {
        newX = 10;
      }
      
      // Prevent going off top edge
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

  // ✅ MOBILE FIX: Also close on touch outside
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
    console.log('🗑️ DELETE MESSAGE INITIATED');
    console.log('   Message ID:', message.id);
    console.log('   Message ID type:', typeof message.id);
    console.log('   Message ID length:', message.id?.length);
    console.log('   Channel ID:', channelId);
    console.log('   Space ID:', spaceId);
    console.log('   Current user:', activeAccount?.address);
    console.log('   adminRedact available:', !!adminRedact);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!adminRedact) {
      console.error('❌ adminRedact function not available');
      toast.error('Delete function not available. Check console for details.');
      return;
    }

    // ✅ Validate message.id is a string
    if (!message.id || typeof message.id !== 'string') {
      console.error('❌ Invalid message ID:', message.id);
      toast.error('Invalid message ID. Cannot delete.');
      return;
    }

    // ✅ Validate it looks like a Towns event ID (64 character hex hash)
    if (message.id.length !== 64 || !/^[a-f0-9]+$/.test(message.id)) {
      console.warn('⚠️ Message ID does not look like a Towns event ID:', message.id);
      console.warn('   Expected: 64-character hex hash');
      console.warn('   Got:', `${message.id.length} characters`);
    }

    if (!confirm('Delete this message from Towns Protocol?')) return;

    setIsProcessing(true);
    try {
      console.log('🔄 Attempting to delete with event ID:', message.id);
      
      // ✅ TRY METHOD 1: Pass as string (per type definition)
      try {
        console.log('   Method 1: Calling adminRedact(eventId) with string...');
        await adminRedact(message.id);
        console.log('✅ Method 1 succeeded! Message redacted.');
        toast.success('Message deleted from Towns Protocol');
        onClose();
        return;
      } catch (error1: any) {
        console.warn('⚠️ Method 1 failed:', error1.message);
        
        // ✅ TRY METHOD 2: Pass as object (per example code)
        try {
          console.log('   Method 2: Calling adminRedact({ eventId }) with object...');
          await adminRedact({ eventId: message.id } as any);
          console.log('✅ Method 2 succeeded! Message redacted.');
          toast.success('Message deleted from Towns Protocol');
          onClose();
          return;
        } catch (error2: any) {
          console.error('❌ Method 2 also failed:', error2.message);
          throw error2; // Re-throw to be caught by outer catch
        }
      }
      
    } catch (error: any) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ BOTH METHODS FAILED - FULL ERROR DETAILS:');
      console.error('   Error object:', error);
      console.error('   Error type:', typeof error);
      console.error('   Error constructor:', error?.constructor?.name);
      console.error('   Error message:', error?.message);
      console.error('   Error stack:', error?.stack);
      console.error('   Error code:', error?.code);
      console.error('   Error name:', error?.name);
      console.error('   All error keys:', Object.keys(error || {}));
      console.error('   Stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Better error messages
      if (error.message?.includes('permission') || error.message?.includes('unauthorized') || error.message?.includes('Redact')) {
        toast.error('You need admin/moderator permissions in this Towns space');
      } else if (error.message?.includes('not found')) {
        toast.error('Message not found or already deleted');
      } else if (error.message?.includes('startsWith')) {
        toast.error('SDK version mismatch. Please report this error to support.');
      } else {
        toast.error(error.message || 'Failed to delete message');
      }
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
            <span>Delete Message</span>
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
