import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listType, subject, htmlContent, fromEmail, campaignName, adminAddress } = body;

    // Validate admin
    const masterAdmin = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET || '';
    if (!adminAddress || adminAddress.toLowerCase() !== masterAdmin.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!listType || !['events', 'contributors'].includes(listType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid list type. Must be "events" or "contributors".' },
        { status: 400 }
      );
    }

    if (!subject || !htmlContent || !fromEmail || !campaignName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: subject, htmlContent, fromEmail, campaignName' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const table =
      listType === 'events'
        ? 'email_subscriptions_events'
        : 'email_subscriptions_contributors';

    const { data: subscribers, error: fetchError } = await supabase
      .from(table)
      .select('email')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching subscribers:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch subscribers' },
        { status: 500 }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, errors: [] });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const emails = subscribers.map((s) => s.email as string);
    const errors: string[] = [];
    let sentCount = 0;

    // Send in batches of BATCH_SIZE
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      try {
        await resend.emails.send({
          from: fromEmail,
          to: batch,
          subject,
          html: htmlContent,
        });
        sentCount += batch.length;
      } catch (batchError: unknown) {
        const message = batchError instanceof Error ? batchError.message : String(batchError);
        console.error(`Error sending batch ${i / BATCH_SIZE + 1}:`, batchError);
        errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${message}`);
      }
    }

    // Save campaign record
    const { error: campaignError } = await supabase.from('email_campaigns').insert({
      name: campaignName,
      subject,
      from_email: fromEmail,
      html_content: htmlContent,
      list_type: listType,
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      created_by: adminAddress,
    });

    if (campaignError) {
      console.error('Error saving campaign record:', campaignError);
      // Don't fail the whole request if only the record save fails
    }

    return NextResponse.json({ success: true, sentCount, errors });
  } catch (err) {
    console.error('Send campaign error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
