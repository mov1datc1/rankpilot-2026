'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function updateSubmissionDocumentUrl(submissionId: string, url: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission || submission.userId !== user.id) {
      throw new Error('Unauthorized');
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: { documentUrl: url }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating document URL:', error);
    return { success: false, error: error.message };
  }
}
