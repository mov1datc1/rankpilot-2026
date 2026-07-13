'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

// =====================================================
// FIRM ACTIONS
// =====================================================

async function getResolvedUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  let resolvedUserId = user.id;
  if (user.email) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) resolvedUserId = existing.id;
  }
  return resolvedUserId;
}

export async function createFirm(data: { name: string; country?: string; city?: string }) {
  try {
    const userId = await getResolvedUserId();
    
    // Check if firm already exists for this user
    const existing = await prisma.firm.findUnique({
      where: { userId_name: { userId, name: data.name } }
    });
    
    if (existing) {
      return { success: true, data: existing, isExisting: true };
    }
    
    const firm = await prisma.firm.create({
      data: {
        userId,
        name: data.name,
        country: data.country || null,
        city: data.city || null,
      }
    });
    
    return { success: true, data: firm, isExisting: false };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getUserFirms() {
  try {
    const userId = await getResolvedUserId();
    
    const firms = await prisma.firm.findMany({
      where: { userId },
      include: { _count: { select: { matters: true } } },
      orderBy: { name: 'asc' }
    });
    
    return { success: true, data: firms };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// STANDALONE MATTER ACTIONS (for Matter Library)
// =====================================================

export async function createStandaloneMatter(data: {
  name: string;
  client: string;
  value?: string;
  leadPartner?: string;
  description?: string;
  practiceArea?: string;
  jurisdiction?: string;
  firmId?: string;
  firmName?: string;
  tags?: string;
}) {
  try {
    const userId = await getResolvedUserId();
    
    // Auto-create firm if firmName provided but no firmId
    let firmId = data.firmId || null;
    if (!firmId && data.firmName) {
      const firmResult = await createFirm({ name: data.firmName });
      if (firmResult.success && firmResult.data) {
        firmId = firmResult.data.id;
      }
    }
    
    const matter = await prisma.matter.create({
      data: {
        userId,
        firmId,
        name: data.name,
        client: data.client,
        value: data.value || 'N/A',
        leadPartner: data.leadPartner || '',
        description: data.description || null,
        practiceArea: data.practiceArea || null,
        jurisdiction: data.jurisdiction || null,
        source: 'assistant',
        status: 'Draft',
        tags: data.tags || null,
      }
    });
    
    return { success: true, data: matter };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addMatterSource(matterId: string, source: {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  rawText?: string;
}) {
  try {
    const result = await prisma.matterSource.create({
      data: {
        matterId,
        fileName: source.fileName,
        fileUrl: source.fileUrl,
        fileType: source.fileType,
        fileSize: source.fileSize || 0,
        rawText: source.rawText || null,
      }
    });
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getLibraryMatters(filters?: {
  practiceArea?: string;
  jurisdiction?: string;
  firmId?: string;
  source?: string;
  search?: string;
}) {
  try {
    const userId = await getResolvedUserId();
    
    const where: any = { userId };
    if (filters?.practiceArea) where.practiceArea = filters.practiceArea;
    if (filters?.jurisdiction) where.jurisdiction = filters.jurisdiction;
    if (filters?.firmId) where.firmId = filters.firmId;
    if (filters?.source) where.source = filters.source;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { client: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    const matters = await prisma.matter.findMany({
      where,
      include: {
        firm: { select: { id: true, name: true } },
        submission: { select: { id: true, targetDirectory: true, practiceArea: true } },
        sources: { select: { id: true, fileName: true, fileType: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return { success: true, data: matters };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function attachMattersToSubmission(submissionId: string, matterIds: string[]) {
  try {
    const userId = await getResolvedUserId();
    
    // Verify submission belongs to user
    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission || submission.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // Link each matter to this submission
    const results = await prisma.matter.updateMany({
      where: { id: { in: matterIds }, userId },
      data: { submissionId }
    });
    
    return { success: true, count: results.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
