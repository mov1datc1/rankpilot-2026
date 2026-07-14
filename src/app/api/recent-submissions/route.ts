import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false });

    let userId = user.id;
    if (user.email) {
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) userId = existing.id;
    }

    const submissions = await prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        targetDirectory: true,
        practiceArea: true,
        chambersData: true,
      },
    });

    const items = submissions.map(s => {
      const cd = s.chambersData as any;
      const firmName = cd?.firm_name || cd?.firmName || cd?.strategicContext?.firm_name || cd?.metadata?.firm_name || '';
      return {
        name: firmName ? `${firmName} · ${s.practiceArea}` : `${s.targetDirectory} · ${s.practiceArea}`,
        href: `/reports/${s.id}`,
        directory: s.targetDirectory,
      };
    });

    return NextResponse.json({ success: true, items });
  } catch {
    return NextResponse.json({ success: false, items: [] });
  }
}
