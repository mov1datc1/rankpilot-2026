'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function createSubmission(data: {
  targetDirectory: string;
  practiceArea: string;
  guideRegion: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        targetDirectory: data.targetDirectory,
        practiceArea: data.practiceArea,
        guideRegion: data.guideRegion,
        currentBand: 'N/A',
        status: 'Draft'
      }
    });

    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error creating submission:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserSubmissions() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: submissions };
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSubmissionStatus(id: string, status: string, score: number) {
  try {
    const submission = await prisma.submission.update({
      where: { id },
      data: { status, completenessScore: score }
    });
    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error updating submission:', error);
    return { success: false, error: error.message };
  }
}
