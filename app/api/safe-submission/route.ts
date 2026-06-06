import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, amount, address, accredited } = body;

    if (!name || !email || !amount || !address) {
      return NextResponse.json(
        { success: false, error: 'All fields are required.' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('safe_submissions')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        amount: parseInt(amount),
        address: address.trim(),
        accredited: accredited === 'accredited',
        submitted_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Supabase error saving SAFE submission:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save submission. Please try again.' },
        { status: 500 }
      );
    }

    // Send notification email via Resend if configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Knead <noreply@kneadmag.com>',
          to: ['joe@josephgenest.com'],
          subject: `New FF Round Submission — ${name} ($${parseInt(amount).toLocaleString()})`,
          html: `
            <h2>New SAFE Submission</h2>
            <table>
              <tr><td><strong>Name</strong></td><td>${name}</td></tr>
              <tr><td><strong>Email</strong></td><td>${email}</td></tr>
              <tr><td><strong>Amount</strong></td><td>$${parseInt(amount).toLocaleString()}</td></tr>
              <tr><td><strong>Address</strong></td><td>${address}</td></tr>
              <tr><td><strong>Status</strong></td><td>${accredited === 'accredited' ? 'Accredited' : 'Unaccredited'}</td></tr>
            </table>
          `,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('SAFE submission error:', err);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
