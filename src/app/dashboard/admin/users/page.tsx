import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const dbUser = await prisma.user.findUnique({
    where: { email: user?.email },
  });

  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Classify users into 3 groups
  const saasUsers = allUsers.filter(u => 
    u.role === 'USER' && u.stripeCustomerId
  );

  const manualClients = allUsers.filter(u => 
    u.role === 'USER' && !u.stripeCustomerId
  );

  const adminUsers = allUsers.filter(u => 
    u.role === 'ADMIN' || u.role === 'SUPERADMIN'
  );

  // Format for serialization
  const format = (users: typeof allUsers) => users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    accountType: u.accountType,
    status: u.status,
    stripeCustomerId: u.stripeCustomerId,
    subscriptionId: u.subscriptionId,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <UsersClient 
      saasUsers={format(saasUsers)}
      manualClients={format(manualClients)}
      adminUsers={format(adminUsers)}
      currentUserRole={dbUser?.role || 'USER'}
    />
  );
}
