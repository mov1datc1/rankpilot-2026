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

    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        resolvedUserId = existingByEmail.id;
      }
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: resolvedUserId },
      include: { matters: true },
      orderBy: { createdAt: 'desc' },
    });

    const isMatterOptimized = (m: any, subStatus?: string): boolean => {
      if (subStatus === 'Optimized') return true;
      const status = (m.status || '').toLowerCase();
      if (status === 'approved' || status === 'ai optimized' || status === 'optimized') return true;
      if (m.optimizedText && String(m.optimizedText).trim().length > 20) return true;
      return false;
    };

    const totalSubmissions = submissions.length;
    const totalMatters = submissions.reduce((acc, s) => acc + s.matters.length, 0);
    const optimizedMatters = submissions.reduce((acc, s) => acc + s.matters.filter(m => isMatterOptimized(m, s.status)).length, 0);
    const readySubmissions = submissions.filter(s => {
      if (s.status === 'Optimized') return true;
      const t = s.matters.length;
      const o = s.matters.filter(m => isMatterOptimized(m, s.status)).length;
      return t > 0 && t === o;
    }).length;

    const recentSubmissions = submissions.slice(0, 8).map(s => {
      const optCount = s.matters.filter(m => isMatterOptimized(m, s.status)).length;
      return {
        id: s.id,
        targetDirectory: s.targetDirectory,
        practiceArea: s.practiceArea,
        guideRegion: s.guideRegion,
        status: s.status,
        mattersCount: s.matters.length,
        optimizedCount: optCount,
        createdAt: s.createdAt,
        chambersData: s.chambersData,
      };
    });

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
