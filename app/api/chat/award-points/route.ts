import { NextRequest, NextResponse } from 'next/server';
import { calculatePointAward } from '@/lib/chat/calculate-points';
import type { ActionType } from '@/lib/chat/point-values';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/award-points
 * 
 * Contributor awards points to a participant for quality contribution
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contributorId, participantId, actionType, eventId, messageId, bonusPoints } = body;

    // Validate required fields
    if (!contributorId || !participantId || !actionType || !eventId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters: contributorId, participantId, actionType, eventId' 
        },
        { status: 400 }
      );
    }

    // Validate action type
    const validActions = [
      'timely_question',
      'substantive_comment',
      'threaded_reply',
      'insightful_reaction',
      'simple_like',
      'original_content',
    ];

    if (!validActions.includes(actionType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid action type. Must be one of: ${validActions.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Calculate and execute point award
    const result = await calculatePointAward({
      contributorId,
      participantId,
      actionType: actionType as ActionType,
      eventId,
      messageId: messageId || undefined,
      bonusPoints: bonusPoints || 0,
    });

    return NextResponse.json({
      success: true,
      calculation: result,
      message: `Successfully awarded ${result.participantReceives.toFixed(2)} points to participant. You earned ${result.contributorKeeps.toFixed(2)} points.`,
    });

  } catch (error) {
    console.error('Point award error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/award-points
 * 
 * Get contributor's current award statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contributorId = searchParams.get('contributorId');

    if (!contributorId) {
      return NextResponse.json(
        { success: false, error: 'Missing contributorId parameter' },
        { status: 400 }
      );
    }

    const { getContributorStats } = await import('@/lib/chat/calculate-points');
    const stats = await getContributorStats(contributorId);

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
