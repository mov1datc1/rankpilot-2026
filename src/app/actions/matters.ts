'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function createMatter(data: {
  submissionId: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Opcional: Validar que la submission pertenezca al usuario
    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId }
    });

    if (!submission || submission.userId !== user.id) {
      throw new Error('No tienes permiso para agregar casos a este proyecto.');
    }

    const matter = await prisma.matter.create({
      data: {
        submissionId: data.submissionId,
        name: data.name,
        client: data.client,
        value: data.value,
        leadPartner: data.leadPartner,
        rawNotes: data.rawNotes,
        status: 'Draft'
      }
    });

    return { success: true, data: matter };
  } catch (error: any) {
    console.error('Error creating matter:', error);
    return { success: false, error: error.message };
  }
}

export async function getMattersBySubmission(submissionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
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

export async function updateMatterOptimization(id: string, optimizedText: string) {
  try {
    const matter = await prisma.matter.update({
      where: { id },
      data: { optimizedText, status: 'AI Optimized' }
    });
    return { success: true, data: matter };
  } catch (error: any) {
    console.error('Error updating matter:', error);
    return { success: false, error: error.message };
  }
}
