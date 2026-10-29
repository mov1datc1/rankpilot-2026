import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

const SUPERADMIN_EMAILS = ['palacios.jenrique@gmail.com', 'jonathan@movidatci.com'];

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('No autorizado: Sesión requerida.');
  }

  let dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  // Auto-upgrade mechanism for designated SUPERADMIN emails
  if (dbUser && SUPERADMIN_EMAILS.includes(dbUser.email) && dbUser.role !== 'SUPERADMIN') {
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: 'SUPERADMIN' },
    });
  }

  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) {
    throw new Error('No autorizado: Permisos insuficientes.');
  }

  return dbUser;
}

export async function requireSuperAdmin() {
  const dbUser = await requireAdmin();
  if (dbUser.role !== 'SUPERADMIN') {
    throw new Error('No autorizado: Se requiere rol de SUPERADMIN.');
  }
  return dbUser;
}
