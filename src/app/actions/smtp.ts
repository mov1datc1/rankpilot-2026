'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guards';

export async function getEmailTemplates() {
  try {
    await requireAdmin();
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { type: 'asc' }
    });
    return templates;
  } catch (error: any) {
    console.error('Error fetching email templates:', error);
    return [];
  }
}

export async function saveEmailTemplate(type: string, subject: string, htmlBody: string) {
  try {
    await requireAdmin();
    await prisma.emailTemplate.upsert({
      where: { type },
      update: { subject, htmlBody },
      create: { type, subject, htmlBody },
    });

    revalidatePath('/dashboard/admin/smtp');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testResendConnection(toEmail: string, fromEmail: string) {
  try {
    await requireAdmin();
    // Try to get API key from SystemConfig first, then fall back to env
    const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
    const apiKey = config?.resendApiKey || process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'API Key de Resend no configurada. Agrégala en Configuración de Sistema.' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    
    const { error } = await resend.emails.send({
      from: fromEmail || 'Rankings Decoded <info@rankingsdecoded.com>',
      to: toEmail,
      subject: '[Rankings Decoded] Correo de Prueba — Conexión Exitosa',
      html: '<h1>¡Conexión Exitosa!</h1><p>Este es un correo de prueba desde el panel de administración de Rankings Decoded.</p><p>Tu configuración de Resend está funcionando correctamente con el dominio rankingsdecoded.com.</p>',
    });

    if (error) {
      return { success: false, error: `Error de Resend: ${error.message}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al conectar con Resend.' };
  }
}

export async function saveResendConfig(apiKey: string, fromEmail: string) {
  try {
    await requireAdmin();
    await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: { resendApiKey: apiKey, resendFromEmail: fromEmail },
      create: { id: 'global', resendApiKey: apiKey, resendFromEmail: fromEmail },
    });

    revalidatePath('/dashboard/admin/smtp');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
