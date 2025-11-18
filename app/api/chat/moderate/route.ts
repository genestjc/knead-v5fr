import { NextRequest, NextResponse } from 'next/server';
import { moderateContent, shouldAutoFlag, shouldAutoReject } from '@/lib/chat/moderation';
import type { ApiResponse, ModerationResult } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/moderate
 * Standalone content moderation check using OpenAI
 * Useful for real-time preview/validation before posting
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing or invalid content parameter' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Content cannot be empty' },
        { status: 400 }
      );
    }

    // Moderate content using OpenAI
    const moderationResult = await moderateContent(content);

    const response: ApiResponse<ModerationResult> = {
      success: true,
      data: {
        flagged: moderationResult.flagged,
        score: moderationResult.score,
        categories: moderationResult.categories,
        message: moderationResult.message,
      },
    };

    // Add additional metadata
    const shouldFlag = shouldAutoFlag(moderationResult);
    const shouldReject = shouldAutoReject(moderationResult);

    return NextResponse.json({
      ...response,
      shouldFlag,
      shouldReject,
      recommendation: shouldReject 
        ? 'reject' 
        : shouldFlag 
        ? 'flag' 
        : 'approve',
    });
  } catch (error) {
    console.error('Error in POST /api/chat/moderate:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}