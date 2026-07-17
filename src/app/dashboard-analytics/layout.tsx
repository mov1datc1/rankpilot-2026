import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userRole = 'USER';
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { role: true } });
      if (dbUser) userRole = dbUser.role;
    }
  } catch {}

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar userRole={userRole} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        <main style={{ padding: '2rem', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
