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

export async function createSubmission(data: {
  targetDirectory: string;
  practiceArea: string;
  guideRegion: string;
}) {
  try {
    const user = await getAuthenticatedUser();

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
    const user = await getAuthenticatedUser();

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

export async function updateSubmissionStatus(id: string, status: string, score?: number) {
  try {
    const user = await getAuthenticatedUser();

    // Validar ownership
    const existing = await prisma.submission.findUnique({
      where: { id }
    });

    if (!existing || existing.userId !== user.id) {
      throw new Error('No tienes permiso para actualizar este submission.');
    }

    const dataToUpdate: any = { status };
    if (score !== undefined) {
      dataToUpdate.completenessScore = score;
    }
    
    // Status tracking
    if (status === 'Submitted' && !existing.submittedAt) dataToUpdate.submittedAt = new Date();
    if (status === 'Accepted' && !existing.acceptedAt) dataToUpdate.acceptedAt = new Date();
    if (status === 'Rejected' && !existing.rejectedAt) dataToUpdate.rejectedAt = new Date();

    const submission = await prisma.submission.update({
      where: { id },
      data: dataToUpdate
    });
    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error updating submission:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Submission Department Data (Chambers Sections A4, B, C) ──
export async function updateSubmissionDepartment(submissionId: string, deptData: {
  contacts: { name: string; email: string; phone: string }[];
  departmentName: string;
  numPartners: number;
  numLawyers: number;
  departmentHeads: { name: string; email: string; phone: string }[];
  hires: { name: string; status: string; firm: string }[];
  lawyers: {
    name: string; url: string; currentRank: string; suggestedRank: string;
    focus: string; bio: string; standoutWork: string; isPartner: boolean; isRanked: boolean;
  }[];
  departmentDesc: string;
  feedback: string;
}) {
  try {
    const user = await getAuthenticatedUser();
    const existing = await prisma.submission.findUnique({ where: { id: submissionId } });

    if (!existing || existing.userId !== user.id) {
      throw new Error('No tienes permiso para actualizar este submission.');
    }

    const existingData = (existing.chambersData as any) || {};

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        chambersData: {
          ...existingData,
          contacts: deptData.contacts,
          departmentName: deptData.departmentName,
          numPartners: deptData.numPartners,
          numLawyers: deptData.numLawyers,
          departmentHeads: deptData.departmentHeads,
          hires: deptData.hires,
          lawyers: deptData.lawyers,
          departmentDesc: deptData.departmentDesc,
          feedback: deptData.feedback,
        }
      }
    });

    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error updating department data:', error);
    return { success: false, error: error.message };
  }
}
