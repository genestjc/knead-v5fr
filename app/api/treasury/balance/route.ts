import { NextResponse } from 'next/server';
import { getContractBalance } from '@/lib/blockchain/award-rewards-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const balance = await getContractBalance();
    
    return NextResponse.json({
      success: true,
      balance,
    });
  } catch (error: any) {
    console.error('Error fetching treasury balance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch treasury balance' 
      },
      { status: 500 }
    );
  }
}
