'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function getUserSubmissionsWithMatters() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      include: {
        matters: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: submissions };
  } catch (error: any) {
    console.error('Error fetching submissions for reports:', error);
    return { success: false, error: error.message };
  }
}
