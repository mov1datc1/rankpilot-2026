'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guards';

export async function getSystemConfig() {
  try {
    await requireAdmin();
    let config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
    
    if (!config) {
      config = await prisma.systemConfig.create({
        data: { id: 'global' }
      });
    }
    
    return config;
  } catch (error: any) {
    console.error('Error fetching system config:', error);
    return {
      id: 'global',
      gaMeasurementId: null,
      gtmContainerId: null,
      resendApiKey: null,
      resendFromEmail: null,
      stripeTestMode: true,
      maintenanceModeEnabled: false,
      updatedAt: new Date(),
    };
  }
}

export async function saveSystemConfig(data: {
  stripeTestMode?: boolean;
  maintenanceModeEnabled?: boolean;
  resendApiKey?: string;
  resendFromEmail?: string;
}) {
  try {
    await requireAdmin();
    const config = await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: data,
      create: { id: 'global', ...data },
    });

    revalidatePath('/dashboard/admin/settings');
    return { success: true, data: config };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function saveGTMConfig(formData: FormData) {
  'use server';
  try {
    await requireAdmin();
    const gtmContainerId = formData.get('gtm-id') as string;
  
    await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: { gtmContainerId },
      create: { id: 'global', gtmContainerId },
    });
    revalidatePath('/dashboard/admin/marketing');
  } catch (error: any) {
    console.error('Error saving GTM config:', error);
  }
}

export async function saveGAConfig(formData: FormData) {
  'use server';
  try {
    await requireAdmin();
    const gaMeasurementId = formData.get('ga-id') as string;
  
    await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: { gaMeasurementId },
      create: { id: 'global', gaMeasurementId },
    });
    revalidatePath('/dashboard/admin/marketing');
  } catch (error: any) {
    console.error('Error saving GA config:', error);
  }
}
