'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getLeadInquiries() {
  try {
    const leads = await (prisma as any).leadInquiry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, leads };
  } catch (error: any) {
    console.error('[LEADS ACTION] Error fetching lead inquiries:', error);
    return { success: false, leads: [], error: error.message };
  }
}

export async function updateLeadStatus(id: string, status: string) {
  try {
    const updated = await (prisma as any).leadInquiry.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/dashboard/admin/leads');
    return { success: true, lead: updated };
  } catch (error: any) {
    console.error('[LEADS ACTION] Error updating lead status:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteLeadInquiry(id: string) {
  try {
    await (prisma as any).leadInquiry.delete({
      where: { id },
    });
    revalidatePath('/dashboard/admin/leads');
    return { success: true };
  } catch (error: any) {
    console.error('[LEADS ACTION] Error deleting lead inquiry:', error);
    return { success: false, error: error.message };
  }
}
