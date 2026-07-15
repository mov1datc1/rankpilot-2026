'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function getDashboardStats() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      include: { matters: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalSubmissions = submissions.length;
    const totalMatters = submissions.reduce((acc, s) => acc + s.matters.length, 0);
    const optimizedMatters = submissions.reduce((acc, s) => acc + s.matters.filter(m => m.status === 'AI Optimized').length, 0);
    const readySubmissions = submissions.filter(s => {
      const t = s.matters.length;
      const o = s.matters.filter(m => m.status === 'AI Optimized').length;
      return t > 0 && t === o;
    }).length;

    const recentSubmissions = submissions.slice(0, 5).map(s => ({
      id: s.id,
      targetDirectory: s.targetDirectory,
      practiceArea: s.practiceArea,
      guideRegion: s.guideRegion,
      mattersCount: s.matters.length,
      optimizedCount: s.matters.filter(m => m.status === 'AI Optimized').length,
      createdAt: s.createdAt,
      chambersData: s.chambersData,
    }));

    return {
      success: true,
      data: {
        totalSubmissions,
        totalMatters,
        optimizedMatters,
        readySubmissions,
        recentSubmissions
      }
    };
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return { success: false, error: error.message };
  }
}
