import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import Sidebar from '@/components/Sidebar';
import AdminTabs from '@/components/AdminTabs';

// Auto-upgrade emails to SUPERADMIN (transitional mechanism)
const SUPERADMIN_EMAILS = ['palacios.jenrique@gmail.com'];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Find or auto-upgrade user
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
    redirect('/submissions');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#020617', color: '#f8fafc' }}>
      <Sidebar userRole={dbUser.role} />
      
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 3rem' }}>
          {/* Header */}
          <div style={{ marginBottom: '0.5rem' }}>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 700, 
              color: '#f8fafc', 
              letterSpacing: '-0.02em',
              marginBottom: '0.25rem'
            }}>
              Administración del SaaS
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Supervisa métricas de negocio, gestiona el acceso de los clientes y ajusta la configuración global.
            </p>
          </div>

          {/* Tabs */}
          <AdminTabs userRole={dbUser.role} />

          {/* Page Content */}
          {children}
        </div>
      </main>
    </div>
  );
}
