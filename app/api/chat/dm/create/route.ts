import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/chat/dm/create
 * 
 * Create a new direct message conversation between two contributors
 * - Validates both users are contributors
 * - Checks if DM already exists
 * - Creates DM via Towns SDK
 * - Stores in Supabase chat_dms table
 */
export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client inside the function
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { userId, recipientId } = await req.json();

    if (!userId || !recipientId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, recipientId' },
        { status: 400 }
      );
    }

    if (userId === recipientId) {
      return NextResponse.json(
        { error: 'Cannot create DM with yourself' },
        { status: 400 }
      );
    }

    // Validate both users exist and are contributors
    const { data: users, error: usersError } = await supabase
      .from('chat_users')
      .select('id, role, wallet_address')
      .in('id', [userId, recipientId]);

    if (usersError || !users || users.length !== 2) {
      return NextResponse.json(
        { error: 'One or both users not found' },
        { status: 404 }
      );
    }

    // Check both are contributors
    const allContributors = users.every(user => user.role === 'contributor');
    if (!allContributors) {
      return NextResponse.json(
        { 
          error: 'Both users must be contributors to create direct messages',
          requiredRole: 'contributor'
        },
        { status: 403 }
      );
    }

    // Check if DM already exists (order-independent)
    const { data: existingDm } = await supabase
      .from('chat_dms')
      .select('*')
      .or(`and(user_a.eq.${userId},user_b.eq.${recipientId}),and(user_a.eq.${recipientId},user_b.eq.${userId})`)
      .single();

    if (existingDm) {
      return NextResponse.json({
        success: true,
        data: existingDm,
        message: 'DM conversation already exists',
      });
    }

    // TODO: Create DM via Towns SDK
    // For now, we'll create a placeholder Towns DM ID
    // Once Towns SDK is fully integrated, replace this with:
    // const townsDmId = await createTownsDm(users[0].wallet_address, users[1].wallet_address);
    const townsDmId = `towns-dm-${userId}-${recipientId}-${Date.now()}`;

    // Create DM record in Supabase
    const { data: newDm, error: createError } = await supabase
      .from('chat_dms')
      .insert({
        user_a: userId,
        user_b: recipientId,
        towns_dm_id: townsDmId,
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create DM:', createError);
      return NextResponse.json(
        { error: 'Failed to create DM conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newDm,
      message: 'DM conversation created successfully',
    });

  } catch (error) {
    console.error('DM creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create DM',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
