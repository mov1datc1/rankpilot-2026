import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

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
    // Si no es admin, lo mandamos al dashboard normal o al wizard
    redirect('/wizard');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar Básico */}
      <aside style={{ width: '250px', borderRight: '1px solid var(--border-subtle)', padding: '2rem' }}>
        <h2 className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>RankPilot Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)' }}>
            Usuarios (SaaS)
          </div>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
            Configuración
          </div>
          {dbUser.role === 'SUPERADMIN' && (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: '#ef4444' }}>
              Gestión de Admins
            </div>
          )}
        </nav>
        
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{dbUser.email}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rol: {dbUser.role}</p>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main style={{ flex: 1, padding: '3rem' }}>
        {children}
      </main>
    </div>
  );
}
