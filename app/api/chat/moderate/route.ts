import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { message } = await request.json();

    // Example moderation check logic
    const inappropriateContent = ['hate', 'violence', 'sexual'];  // Placeholder for actual moderation keywords
    let isAppropriate = true;
    let reason = '';

    for (const term of inappropriateContent) {
        if (message.includes(term)) {
            isAppropriate = false;
            reason = `Message contains inappropriate content: ${term}`;
            break;
        }
    }

    return NextResponse.json({
        isAppropriate,
        reason,
    });
}