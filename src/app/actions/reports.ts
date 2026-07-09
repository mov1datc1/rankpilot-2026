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

    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        resolvedUserId = existingByEmail.id;
      }
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: resolvedUserId },
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
export async function deleteSubmission(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        resolvedUserId = existingByEmail.id;
      }
    }

    const existing = await prisma.submission.findUnique({
      where: { id }
    });

    if (!existing || existing.userId !== resolvedUserId) {
      return { success: false, error: 'Unauthorized to delete this submission' };
    }

    await prisma.submission.delete({
      where: { id }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting submission:', error);
    return { success: false, error: error.message };
  }
}
