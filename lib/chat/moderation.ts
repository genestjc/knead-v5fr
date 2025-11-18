import OpenAI from 'openai';
import type { ModerationResult } from '@/types/chat';
import { MODERATION_THRESHOLDS } from './config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Moderate content using OpenAI Moderation API
 * Fail-open design: If API fails, allow the message
 */
export async function moderateContent(content: string): Promise<ModerationResult> {
  try {
    const moderation = await openai.moderations.create({
      input: content,
    });

    const result = moderation.results[0];
    
    // Extract category scores
    const categories = {
      hate: result.category_scores.hate,
      harassment: result.category_scores.harassment,
      selfHarm: result.category_scores['self-harm'],
      sexual: result.category_scores.sexual,
      violence: result.category_scores.violence,
    };

    // Find the highest score
    const maxScore = Math.max(...Object.values(categories));

    return {
      flagged: result.flagged || maxScore > MODERATION_THRESHOLDS.autoFlag,
      score: maxScore,
      categories,
      message: result.flagged ? getFlaggedMessage(categories) : undefined,
    };
  } catch (error) {
    console.error('OpenAI moderation API error:', error);
    
    // Fail-open: If API is down, allow the message
    return {
      flagged: false,
      score: 0,
      categories: {
        hate: 0,
        harassment: 0,
        selfHarm: 0,
        sexual: 0,
        violence: 0,
      },
      message: 'Moderation service temporarily unavailable',
    };
  }
}

/**
 * Check if content should be automatically flagged
 */
export function shouldAutoFlag(moderationResult: ModerationResult): boolean {
  return moderationResult.flagged || moderationResult.score > MODERATION_THRESHOLDS.autoFlag;
}

/**
 * Check if content should be automatically rejected
 */
export function shouldAutoReject(moderationResult: ModerationResult): boolean {
  return moderationResult.score > MODERATION_THRESHOLDS.autoReject;
}

/**
 * Get user-friendly error message for flagged content
 */
export function getFlaggedMessage(categories: ModerationResult['categories']): string {
  const flaggedCategories: string[] = [];
  
  if (categories.hate > MODERATION_THRESHOLDS.autoFlag) {
    flaggedCategories.push('hate speech');
  }
  if (categories.harassment > MODERATION_THRESHOLDS.autoFlag) {
    flaggedCategories.push('harassment');
  }
  if (categories.selfHarm > MODERATION_THRESHOLDS.autoFlag) {
    flaggedCategories.push('self-harm content');
  }
  if (categories.sexual > MODERATION_THRESHOLDS.autoFlag) {
    flaggedCategories.push('sexual content');
  }
  if (categories.violence > MODERATION_THRESHOLDS.autoFlag) {
    flaggedCategories.push('violence');
  }

  if (flaggedCategories.length === 0) {
    return 'Your message contains inappropriate content and cannot be posted.';
  }

  return `Your message was flagged for containing: ${flaggedCategories.join(', ')}. Please revise and try again.`;
}
