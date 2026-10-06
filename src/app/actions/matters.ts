'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

// ── Helper: Get authenticated user or throw ──
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Si existe en Prisma por email pero con otro ID (para evitar errores de UNIQUE constraint)
  if (user.email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
    if (existingByEmail && existingByEmail.id !== user.id) {
      return { ...user, id: existingByEmail.id };
    }
  }

  // Auto-sync Supabase Auth user to Prisma User table
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email || 'unknown@email.com',
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  return user;
}

// ── Create Matter ──
export async function createMatter(data: {
  submissionId: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes?: string;
  isConfidential?: boolean;
  crossBorder?: string;
  teamMembers?: string;
  otherFirms?: string;
  completionDate?: string;
  otherInfo?: string;
  isNewClient?: boolean;
}) {
  try {
    const user = await getAuthenticatedUser();

    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId }
    });

    if (!submission || submission.userId !== user.id) {
      throw new Error('No tienes permiso para agregar casos a este proyecto.');
    }

    const matter = await prisma.matter.create({
      data: {
        submissionId: data.submissionId,
        userId: user.id,
        name: data.name,
        client: data.client,
        value: data.value,
        leadPartner: data.leadPartner,
        rawNotes: data.rawNotes,
        status: 'Draft',
        source: 'builder',
        isConfidential: data.isConfidential || false,
        crossBorder: data.crossBorder || '',
        teamMembers: data.teamMembers || '',
        otherFirms: data.otherFirms || '',
        completionDate: data.completionDate || '',
        otherInfo: data.otherInfo || '',
        isNewClient: data.isNewClient || false,
      }
    });

    return { success: true, data: matter };
  } catch (error: any) {
    console.error('Error creating matter:', error);
    return { success: false, error: error.message };
  }
}

// ── Get Matters by Submission ──
export async function getMattersBySubmission(submissionId: string) {
  try {
    const user = await getAuthenticatedUser();

    // Validate ownership
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (!submission || submission.userId !== user.id) {
      return { success: false, error: 'No tienes permiso para ver estos casos.' };
    }

    const matters = await prisma.matter.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: matters };
  } catch (error: any) {
    console.error('Error fetching matters:', error);
    return { success: false, error: error.message };
  }
}

// ── Get All Matters for User ──
export async function getAllUserMatters() {
  try {
    const user = await getAuthenticatedUser();

    const matters = await prisma.matter.findMany({
      where: { userId: user.id },
      include: {
        submission: {
          select: {
            id: true,
            targetDirectory: true,
            practiceArea: true,
            createdAt: true,
            chambersData: true,
          }
        },
        firm: {
          select: {
            id: true,
            name: true
          }
        },
        sources: {
          select: {
            id: true,
            fileName: true,
            fileType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: matters };
  } catch (error: any) {
    console.error('Error fetching all user matters:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Matter Optimization (with ownership check) ──
export async function updateMatterOptimization(id: string, optimizedText: string) {
  try {
    const user = await getAuthenticatedUser();

    // Validate ownership through submission chain
    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para modificar este caso.');
    }

    const updated = await prisma.matter.update({
      where: { id },
      data: { optimizedText, status: 'AI Optimized' }
    });
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error updating matter:', error);
    return { success: false, error: error.message };
  }
}

// ── Delete Matter ──
export async function deleteMatter(id: string) {
  try {
    const user = await getAuthenticatedUser();

    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para eliminar este caso.');
    }

    await prisma.matter.delete({
      where: { id }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting matter:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Matter Inline ──
export async function updateMatterInline(id: string, data: { name?: string; client?: string; value?: string }) {
  try {
    const user = await getAuthenticatedUser();

    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para editar este caso.');
    }

    const updated = await prisma.matter.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.client !== undefined && { client: data.client }),
        ...(data.value !== undefined && { value: data.value }),
      }
    });

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error updating matter inline:', error);
    return { success: false, error: error.message };
  }
}

// ── Optimize Matter with AI (with logging + rate limiting + thread persistence) ──
export async function optimizeMatterWithAI(matterId: string) {
  try {
    const user = await getAuthenticatedUser();
    const startTime = Date.now();

    // 1. Fetch the matter with ownership validation
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para optimizar este caso.');
    }

    if (!matter.rawNotes || matter.rawNotes.trim().length === 0) {
      throw new Error('No hay notas crudas para optimizar.');
    }

    // 2. Rate limiting: Check if this matter was optimized in the last 30 seconds
    const recentLog = await prisma.aILog.findFirst({
      where: {
        matterId: matterId,
        createdAt: { gte: new Date(Date.now() - 30000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentLog) {
      throw new Error('Por favor espera 30 segundos antes de optimizar este caso nuevamente.');
    }

    if(!matter.submissionId) throw new Error('Añade el asunto a un expediente de Submission Studio antes de optimizar.');
    const {POST}=await import('@/app/api/optimize/matter/route');
    const {NextRequest}=await import('next/server');
    const response=await POST(new NextRequest('http://internal/optimize/matter',{method:'POST',body:JSON.stringify({submissionId:matter.submissionId,matterId})}));
    const result=await response.json();
    if(!response.ok || !result.success) throw new Error(result.error || 'La redacción no pasó la revisión.');
    const updatedMatter=await prisma.matter.findUnique({where:{id:matterId}});
    return {success:true,data:updatedMatter};
  } catch (error: any) {
    console.error('Error optimizing matter with Python AI:', error);
    return { success: false, error: error.message };
  }
}

// ── Delete Case Folder (Submission + all its matters) ──
export async function deleteCaseFolder(data: {
  submissionId?: string;
  matterIds: string[];
}) {
  try {
    const user = await getAuthenticatedUser();

    // Step 1: Delete all matters in the folder
    if (data.matterIds.length > 0) {
      // Verify ownership of all matters
      const matters = await prisma.matter.findMany({
        where: { id: { in: data.matterIds } },
      });

      const unauthorized = matters.filter(m => m.userId !== user.id);
      if (unauthorized.length > 0) {
        throw new Error('No tienes permiso para eliminar algunos de estos casos.');
      }

      // Delete MatterSources first (child records)
      await prisma.matterSource.deleteMany({
        where: { matterId: { in: data.matterIds } },
      });

      // Delete the matters themselves
      await prisma.matter.deleteMany({
        where: { id: { in: data.matterIds }, userId: user.id },
      });
    }

    // Step 2: Delete the submission if it exists (builder folders)
    if (data.submissionId) {
      const submission = await prisma.submission.findUnique({
        where: { id: data.submissionId },
        include: { matters: { select: { id: true } } },
      });

      if (submission && submission.userId === user.id) {
        // Delete any remaining matters linked to this submission
        if (submission.matters.length > 0) {
          await prisma.matterSource.deleteMany({
            where: { matterId: { in: submission.matters.map(m => m.id) } },
          });
          await prisma.matter.deleteMany({
            where: { submissionId: data.submissionId },
          });
        }

        // Delete the submission
        await prisma.submission.delete({
          where: { id: data.submissionId },
        });
      }
    }

    return { success: true, deletedCount: data.matterIds.length };
  } catch (error: any) {
    console.error('Error deleting case folder:', error);
    return { success: false, error: error.message };
  }
}

// ── Import Matters from Matter Assistant / Library to a Submission ──
export async function importMattersToSubmission(submissionId: string, matterIds: string[]) {
  try {
    const user = await getAuthenticatedUser();

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (!submission || submission.userId !== user.id) {
      throw new Error('No tienes permiso para modificar este submission.');
    }

    const sourceMatters = await prisma.matter.findMany({
      where: { id: { in: matterIds }, userId: user.id }
    });

    if (sourceMatters.length === 0) {
      return { success: true, count: 0 };
    }

    let importedCount = 0;
    for (const sm of sourceMatters) {
      if (!sm.submissionId) {
        // Standalone library matter -> link directly
        await prisma.matter.update({
          where: { id: sm.id },
          data: { submissionId }
        });
      } else {
        // Belongs to another submission -> clone cleanly to avoid corrupting previous submissions
        await prisma.matter.create({
          data: {
            submissionId,
            userId: user.id,
            firmId: sm.firmId,
            name: sm.name,
            client: sm.client,
            value: sm.value,
            leadPartner: sm.leadPartner,
            rawNotes: sm.rawNotes,
            optimizedText: sm.optimizedText,
            status: sm.status || 'Draft',
            isConfidential: sm.isConfidential,
            crossBorder: sm.crossBorder,
            teamMembers: sm.teamMembers,
            otherFirms: sm.otherFirms,
            completionDate: sm.completionDate,
            otherInfo: sm.otherInfo,
            isNewClient: sm.isNewClient,
            source: 'assistant',
            practiceArea: sm.practiceArea || submission.practiceArea,
            jurisdiction: sm.jurisdiction,
            description: sm.description,
            tags: sm.tags,
          }
        });
      }
      importedCount++;
    }

    return { success: true, count: importedCount };
  } catch (error: any) {
    console.error('Error importing matters to submission:', error);
    return { success: false, error: error.message };
  }
}

