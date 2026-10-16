import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, firmName, role, country, message } = body;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Full name is required.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'A valid work email is required.' },
        { status: 400 }
      );
    }

    if (!firmName || typeof firmName !== 'string' || !firmName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Firm name is required.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please describe your priorities or goals.' },
        { status: 400 }
      );
    }

    // Save lead inquiry to database
    const inquiry = await (prisma as any).leadInquiry.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        firmName: firmName.trim(),
        role: role ? String(role).trim() : null,
        country: country ? String(country).trim() : null,
        message: message.trim(),
        status: 'NEW',
      },
    });

    console.log('[LEAD] New Rankings Decoded inquiry created:', inquiry.id, inquiry.firmName, inquiry.email);

    return NextResponse.json({
      success: true,
      message: 'Thank you for getting in touch. We have received your enquiry and will contact you about the next step.',
      id: inquiry.id,
    });
  } catch (error: any) {
    console.error('[LEAD] Error saving contact inquiry:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to process your enquiry at this moment. Please try again later.' },
      { status: 500 }
    );
  }
}
