import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import AdminSidebar from '@/components/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // RBAC: Verificamos el rol del usuario en la base de datos
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) {
    // Si no es admin, lo mandamos al dashboard normal (submissions)
    redirect('/submissions');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#020617', color: '#f8fafc' }}>
      <AdminSidebar userEmail={dbUser.email} userRole={dbUser.role} />
      
      {/* Contenido Principal */}
      <main style={{ flex: 1, padding: '3rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
