'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Supabase Admin client (for user creation in Auth)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// =====================================================
// CREATE USER
// =====================================================
export async function createUser(data: { 
  email: string; 
  password?: string; 
  role: string;
  name?: string;
  accountType?: string;
}) {
  try {
    const { email, password, role, name, accountType } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return { success: false, error: 'El usuario ya existe en el sistema.' };
    }

    // Create in Supabase Auth if service role key is available
    let authUserId = null;
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || 'RankPilot2026!',
        email_confirm: true,
        user_metadata: { role, name }
      });

      if (authError) throw new Error(`Error en Supabase Auth: ${authError.message}`);
      authUserId = authData.user.id;
    } else {
      console.warn('ADVERTENCIA: SUPABASE_SERVICE_ROLE_KEY no configurada. Usuario creado solo en BD.');
    }

    // Create in Prisma
    const newUser = await prisma.user.create({
      data: {
        id: authUserId || undefined,
        email,
        name: name || null,
        role: role as any,
        accountType: (accountType as any) || 'INDIVIDUAL',
        status: 'ACTIVE'
      }
    });

    // Send welcome email if Resend is configured
    try {
      const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
      if (config?.resendApiKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(config.resendApiKey);
        await resend.emails.send({
          from: config.resendFromEmail || 'RankPilot <noreply@rankpilot.io>',
          to: email,
          subject: '¡Bienvenido a RankPilot!',
          html: `<h1>Bienvenido a RankPilot</h1><p>Hola ${name || email},</p><p>Tu cuenta ha sido creada exitosamente. Ya puedes acceder a la plataforma.</p><p>Contraseña temporal: ${password || 'RankPilot2026!'}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://rankpilot-2026.vercel.app'}/login">Iniciar Sesión</a></p>`
        });
      }
    } catch (emailErr) {
      console.warn('Email de bienvenida no enviado:', emailErr);
    }

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/admin/users');
    return { success: true, data: newUser };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message || 'Error desconocido al crear usuario.' };
  }
}

// =====================================================
// TOGGLE USER STATUS (Activate/Deactivate)
// =====================================================
export async function toggleUserStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'Usuario no encontrado.' };

    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus }
    });

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/admin/users');
    return { success: true, newStatus };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// DELETE USER
// =====================================================
export async function deleteUser(userId: string) {
  try {
    // Delete from Supabase Auth if possible
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e) {
        console.warn('Could not delete from Supabase Auth:', e);
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/admin/users');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// DASHBOARD METRICS
// =====================================================
export async function getAdminDashboardMetrics() {
  try {
    const [totalUsers, activeUsers, allUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.findMany({
        select: { role: true, stripeCustomerId: true, status: true, createdAt: true }
      })
    ]);

    const saasUsers = allUsers.filter(u => 
      u.role === 'USER' && u.stripeCustomerId
    ).length;

    const manualClients = allUsers.filter(u => 
      u.role === 'USER' && !u.stripeCustomerId && u.status === 'ACTIVE'
    ).length;

    const admins = allUsers.filter(u => 
      u.role === 'ADMIN' || u.role === 'SUPERADMIN'
    ).length;

    // Monthly registration data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentUsers = allUsers.filter(u => u.createdAt >= sixMonthsAgo);
    const monthlyData: { month: string; count: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
      const count = recentUsers.filter(u => {
        const uMonth = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
        return uMonth === monthKey;
      }).length;
      monthlyData.push({ month: monthName, count });
    }

    return {
      totalUsers,
      activeUsers,
      saasUsers,
      manualClients,
      admins,
      monthlyData
    };
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    return {
      totalUsers: 0, activeUsers: 0, saasUsers: 0, manualClients: 0, admins: 0,
      monthlyData: []
    };
  }
}
