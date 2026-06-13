import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { verifyAdminRequest } from '@/lib/admin/verify-admin-request';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

// Rate limiting: emails per minute
const RATE_LIMIT = 100;

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req, { requireMaster: true });
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const adminAddress = auth.address!;

    const body = await req.json();
    const { listType, subject, htmlContent, fromEmail, campaignName } = body;

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

    const supabase = createSupabaseAdmin();

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

    const listLabel = listType === 'events' ? 'Events' : 'Contributors';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kneadmag.com';

    console.log(`📧 Starting campaign: "${campaignName}" to ${emails.length} subscribers`);

    // Send individual emails with rate limiting
    for (let i = 0; i < emails.length; i++) {
      const recipientEmail = emails[i];

      // Create personalized unsubscribe footer
      const unsubscribeFooter = `
<hr style="margin: 40px 0; border: none; border-top: 1px solid #e5e7eb;">
<p style="font-size: 12px; color: #6b7280; text-align: center; margin: 20px 0;">
  You're receiving this email because you subscribed to Knead Magazine ${listLabel} updates.<br>
  <a href="${siteUrl}/unsubscribe?email=${encodeURIComponent(recipientEmail)}&type=${listType}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
</p>`;

      const personalizedHtml = htmlContent + unsubscribeFooter;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject,
          html: personalizedHtml,
        });

        sentCount++;

        // Log progress every 10 emails
        if (sentCount % 10 === 0) {
          console.log(`📧 Sent ${sentCount}/${emails.length} emails`);
        }
      } catch (emailError: unknown) {
        const message = emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`Error sending to ${recipientEmail}:`, emailError);
        errors.push(`Failed to send to ${recipientEmail}: ${message}`);
      }

      // Rate limiting: pause after every RATE_LIMIT emails
      if ((i + 1) % RATE_LIMIT === 0 && i + 1 < emails.length) {
        console.log(`⏸️  Rate limit: Pausing for 60 seconds after ${i + 1} emails...`);
        await sleep(60000); // Wait 1 minute
      }
    }

    console.log(`✅ Campaign complete: ${sentCount}/${emails.length} sent, ${errors.length} errors`);

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

    return NextResponse.json({
      success: true,
      sentCount,
      totalSubscribers: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Send campaign error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
