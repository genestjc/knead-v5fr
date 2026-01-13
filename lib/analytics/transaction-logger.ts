/**
 * Transaction Analytics Logger
 * 
 * Logs blockchain transactions for analytics purposes ONLY.
 * The blockchain is the source of truth - this is just for reporting.
 */

import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export interface TransactionLog {
  from: string;
  to: string;
  amount: number;
  txHash: string;
  eventId?: string | null;
  timestamp: number;
}

/**
 * Log blockchain transaction for analytics (NOT source of truth)
 * 
 * This creates an audit trail and makes it easier to generate reports,
 * but the blockchain is always the source of truth for balances.
 * 
 * @param data - Transaction data to log
 */
export async function logTransactionAnalytics(data: TransactionLog): Promise<void> {
  try {
    const supabase = createSupabaseAdmin();
    
    // Insert into analytics table (if it exists)
    // This is fire-and-forget - we don't want analytics logging to block the transaction
    const { error } = await supabase
      .from('transaction_logs')
      .insert({
        tx_hash: data.txHash,
        from_address: data.from.toLowerCase(),
        to_address: data.to.toLowerCase(),
        amount_towns: data.amount,
        event_id: data.eventId,
        created_at: new Date(data.timestamp).toISOString(),
      });
    
    if (error) {
      // Don't throw - just log the error
      // Analytics failures should never block user actions
      console.warn('Analytics logging failed (non-critical):', error.message);
    } else {
      console.log('📊 Transaction logged for analytics:', data.txHash);
    }
  } catch (error) {
    // Fail silently - analytics is not critical
    console.warn('Analytics logging error (non-critical):', error);
  }
}

/**
 * Get analytics summary for a user
 * 
 * @param address - User's wallet address
 * @returns Analytics data from logged transactions
 */
export async function getUserAnalytics(address: string): Promise<{
  totalReceived: number;
  totalSent: number;
  transactionCount: number;
}> {
  try {
    const supabase = createSupabaseAdmin();
    const normalizedAddress = address.toLowerCase();
    
    // Get received transactions
    const { data: received } = await supabase
      .from('transaction_logs')
      .select('amount_towns')
      .eq('to_address', normalizedAddress);
    
    // Get sent transactions
    const { data: sent } = await supabase
      .from('transaction_logs')
      .select('amount_towns')
      .eq('from_address', normalizedAddress);
    
    const totalReceived = received?.reduce((sum, tx) => sum + tx.amount_towns, 0) || 0;
    const totalSent = sent?.reduce((sum, tx) => sum + tx.amount_towns, 0) || 0;
    const transactionCount = (received?.length || 0) + (sent?.length || 0);
    
    return {
      totalReceived,
      totalSent,
      transactionCount,
    };
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return {
      totalReceived: 0,
      totalSent: 0,
      transactionCount: 0,
    };
  }
}
