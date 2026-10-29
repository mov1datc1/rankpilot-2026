import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, firmName, role, country, message } = body;

    // Strict Input Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Full name is required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'A valid work email is required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!firmName || typeof firmName !== 'string' || !firmName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Firm name is required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please describe your firm’s priorities or goals.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirm = firmName.trim();
    const cleanRole = role ? String(role).trim() : null;
    const cleanCountry = country ? String(country).trim() : null;
    const cleanMessage = message.trim();

    // 1. Save lead inquiry to Supabase PostgreSQL database
    let inquiry: any;
    try {
      inquiry = await (prisma as any).leadInquiry.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          firmName: cleanFirm,
          role: cleanRole,
          country: cleanCountry,
          message: cleanMessage,
          status: 'NEW',
        },
      });
      console.log('[LEAD] Saved new inquiry to database:', inquiry.id, cleanFirm, cleanEmail);
    } catch (dbErr: any) {
      console.error('[LEAD] Database insertion failed:', dbErr);
      // Guarantee: Visitor will NEVER receive a success response if DB save fails
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to register your enquiry at this moment. Please try again or contact us directly at info@rankingsdecoded.com.'
        },
        { status: 500 }
      );
    }

    // 2. Email Notifications via Resend
    let emailSent = false;
    let emailError: string | null = null;

    try {
      // Lookup Resend API key: Check SystemConfig in DB, fallback to process.env
      const config = await (prisma as any).systemConfig.findFirst().catch(() => null);
      const resendApiKey = config?.resendApiKey || process.env.RESEND_API_KEY;

      if (resendApiKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(resendApiKey);

        const fromEmail =
          process.env.RESEND_FROM_EMAIL ||
          config?.resendFromEmail ||
          'Rankings Decoded <info@rankingsdecoded.com>';

        const adminRecipients = (
          process.env.CONTACT_NOTIFICATION_EMAILS ||
          process.env.CONTACT_NOTIFICATION_EMAIL ||
          'angela.castillo@rankingsdecoded.com, info@rankingsdecoded.com'
        )
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);

        // A. Internal Notification Email to Advisory Leadership (Angela Castillo & Team)
        const adminEmailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #0f172a; line-height: 1.6;">
            <div style="border-bottom: 2px solid #000073; padding-bottom: 14px; margin-bottom: 20px;">
              <h2 style="color: #000073; margin: 0; font-size: 22px;">New Advisory Consultation Enquiry</h2>
              <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Rankings Decoded — Legal Market Intelligence & Advisory</p>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; width: 130px; font-weight: 600;">Contact Name:</td>
                  <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${cleanName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Work Email:</td>
                  <td style="padding: 6px 0;"><a href="mailto:${cleanEmail}" style="color: #1b44ed; text-decoration: none; font-weight: 600;">${cleanEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Law Firm:</td>
                  <td style="padding: 6px 0; font-weight: 700; color: #000073;">${cleanFirm}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Role / Position:</td>
                  <td style="padding: 6px 0;">${cleanRole || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Jurisdiction:</td>
                  <td style="padding: 6px 0;">${cleanCountry || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Inquiry ID:</td>
                  <td style="padding: 6px 0; font-family: monospace; font-size: 12px; color: #64748b;">${inquiry.id}</td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 24px;">
              <h3 style="color: #0f172a; font-size: 15px; margin: 0 0 8px;">Firm Priorities & Strategic Goals:</h3>
              <div style="background-color: #ffffff; border-left: 3px solid #000073; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 4px; padding: 16px; font-size: 14px; white-space: pre-wrap; color: #334155;">${cleanMessage}</div>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
              <span>Submitted at ${new Date().toUTCString()}</span>
              <span>Status: NEW</span>
            </div>
          </div>
        `;

        // B. Confirmation Receipt Email to the Client / Inquirer
        const clientReceiptHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #0f172a; line-height: 1.65; background-color: #ffffff;">
            <div style="margin-bottom: 24px; border-bottom: 2px solid #000073; padding-bottom: 16px;">
              <h1 style="color: #000073; font-size: 22px; margin: 0; letter-spacing: -0.02em;">Rankings Decoded</h1>
              <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 4px 0 0; font-weight: 600;">Legal Market Intelligence, Strategy & Advisory</p>
            </div>

            <p style="font-size: 15px; color: #0f172a; margin: 0 0 16px;">Dear ${cleanName},</p>

            <p style="font-size: 14px; color: #334155; margin: 0 0 16px;">
              Thank you for contacting <strong>Rankings Decoded</strong>. We have received your enquiry regarding <strong>${cleanFirm}</strong>.
            </p>

            <p style="font-size: 14px; color: #334155; margin: 0 0 16px;">
              Every enquiry is handled with strict professional discretion. Our founder and principal strategist, <strong>Ángela Castillo</strong>, will personally review the details and priorities you shared, and we will follow up with you shortly to schedule an initial discussion.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 24px 0;">
              <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 6px; font-weight: 700;">Your Enquiry Summary</p>
              <p style="font-size: 13px; color: #0f172a; margin: 0 0 4px;"><strong>Firm:</strong> ${cleanFirm}</p>
              <p style="font-size: 13px; color: #0f172a; margin: 0 0 4px;"><strong>Jurisdiction:</strong> ${cleanCountry || 'Worldwide'}</p>
              <p style="font-size: 13px; color: #475569; margin: 0; font-style: italic;">“${cleanMessage.slice(0, 140)}${cleanMessage.length > 140 ? '...' : ''}”</p>
            </div>

            <p style="font-size: 14px; color: #334155; margin: 0 0 24px;">
              In the meantime, if you have additional background or documentation to share, feel free to reply directly to this email or write to <a href="mailto:info@rankingsdecoded.com" style="color: #1b44ed; text-decoration: none; font-weight: 600;">info@rankingsdecoded.com</a>.
            </p>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px;">
              <p style="font-size: 14px; font-weight: 700; color: #000073; margin: 0;">Ángela Castillo</p>
              <p style="font-size: 12px; color: #64748b; margin: 2px 0 0;">Founder & Principal Strategist · Rankings Decoded</p>
              <p style="font-size: 12px; margin: 4px 0 0;">
                <a href="mailto:info@rankingsdecoded.com" style="color: #1b44ed; text-decoration: none;">info@rankingsdecoded.com</a>
                <span style="color: #cbd5e1; margin: 0 6px;">·</span>
                <a href="https://rankingsdecoded.com" style="color: #64748b; text-decoration: none;">rankingsdecoded.com</a>
              </p>
              <p style="font-size: 12px; color: #94a3b8; margin: 12px 0 0;">Independent advice for stronger competitive positioning and smarter business decisions.</p>
            </div>
          </div>
        `;

        // Send both internal notification and client confirmation in parallel
        const [adminResult, clientResult] = await Promise.allSettled([
          resend.emails.send({
            from: fromEmail,
            to: adminRecipients,
            replyTo: cleanEmail,
            subject: `[Rankings Decoded] New Enquiry: ${cleanFirm} — ${cleanName}`,
            html: adminEmailHtml,
          }),
          resend.emails.send({
            from: fromEmail,
            to: [cleanEmail],
            replyTo: 'info@rankingsdecoded.com',
            subject: `Enquiry received: Rankings Decoded — ${cleanFirm}`,
            html: clientReceiptHtml,
          }),
        ]);

        if (adminResult.status === 'fulfilled' && !adminResult.value.error) {
          emailSent = true;
          console.log('[LEAD] Successfully sent admin lead notification via Resend.');
        } else {
          console.error('[LEAD] Admin notification email failed:', adminResult);
        }

        if (clientResult.status === 'fulfilled' && !clientResult.value.error) {
          console.log('[LEAD] Successfully sent client receipt email via Resend.');
        } else {
          console.error('[LEAD] Client receipt email failed:', clientResult);
        }
      } else {
        console.warn('[LEAD] Resend API key is not configured in SystemConfig or process.env.RESEND_API_KEY. Inquiry was saved to database, but notification email was skipped.');
      }
    } catch (mailErr: any) {
      console.error('[LEAD] Resend email delivery failed:', mailErr);
      emailError = mailErr?.message || 'Email delivery failed';
    }

    // Success response with saved inquiry ID and CORS headers
    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for getting in touch. We have received your enquiry and will contact you about the next step.',
        id: inquiry.id,
        emailSent,
        ...(emailError ? { emailWarning: 'Saved to database, notification email pending configuration.' } : {}),
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[LEAD] Unexpected error in contact route:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process your enquiry at this moment. Please try again later or email info@rankingsdecoded.com directly.'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
