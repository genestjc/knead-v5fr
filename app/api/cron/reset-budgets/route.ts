import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This is an admin-level operation, so we use the Supabase service_role key
// which can bypass any Row Level Security policies.
// Store these in your environment variables!
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// This function determines the weekly budget based on contributor type
const getWeeklyBudgetForType = (contributorType: string): number => {
    switch (contributorType) {
        case 'appointed': return 120;
        case 'earned': return 150;
        case 'invited': return 100;
        default: return 0;
    }
};

export async function POST(request: Request) {
    // IMPORTANT: Protect this endpoint!
    // A common method is to require a secret key in the Authorization header.
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        // 1. Fetch all users who are contributors
        const { data: contributors, error: fetchError } = await supabaseAdmin
            .from('chat_users')
            .select('id, contributor_type')
            .eq('role', 'contributor');

        if (fetchError) {
            throw new Error(`Failed to fetch contributors: ${fetchError.message}`);
        }
        
        if (!contributors || contributors.length === 0) {
            return NextResponse.json({ message: 'No contributors found to reset.' });
        }

        const updates = contributors.map(contributor => {
            const newBudget = getWeeklyBudgetForType(contributor.contributor_type!);
            return supabaseAdmin
                .from('chat_users')
                .update({
                    distribution_budget_weekly: newBudget,
                    remaining_weekly_budget: newBudget,
                    distribution_budget_used: 0,
                    last_weekly_reset: new Date().toISOString(),
                })
                .eq('id', contributor.id);
        });

        // 2. Execute all updates in parallel
        const results = await Promise.all(updates);

        const failedUpdates = results.filter(res => res.error);

        if (failedUpdates.length > 0) {
            console.error('Some budget resets failed:', failedUpdates);
            return NextResponse.json({ 
                error: 'Some budget updates failed.', 
                details: failedUpdates.map(f => f.error!.message) 
            }, { status: 500 });
        }

        // 3. Log a successful run
        console.log(`Successfully reset budgets for ${contributors.length} contributors.`);
        return NextResponse.json({ 
            message: `Successfully reset budgets for ${contributors.length} contributors.` 
        });

    } catch (error: any) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: 'Failed to reset weekly budgets.', details: error.message }, { status: 500 });
    }
}
