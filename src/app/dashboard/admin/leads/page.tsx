import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import LeadsClient from './LeadsClient';

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const dbUser = await prisma.user.findUnique({
    where: { email: user?.email },
  });

  const rawLeads = await (prisma as any).leadInquiry.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const leads = rawLeads.map((l: any) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    firmName: l.firmName,
    role: l.role,
    country: l.country,
    message: l.message,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <LeadsClient
      initialLeads={leads}
      currentUserRole={dbUser?.role || 'ADMIN'}
    />
  );
}
