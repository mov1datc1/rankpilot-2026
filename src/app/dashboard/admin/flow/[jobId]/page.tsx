import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { flowAdmin, loadRunFlow } from '@/lib/admin/run-flow-data';
import FlowClient from './FlowClient';

export const dynamic = 'force-dynamic';

export default async function FlowRunPage({ params }: { params: Promise<{ jobId: string }> }) {
  const admin = await flowAdmin();
  if (!admin) redirect('/builder');
  const { jobId } = await params;
  const flow = await loadRunFlow(jobId);
  if (!flow) notFound();
  return (
    <div>
      <Link href="/dashboard/admin/flow" style={{ color: '#94a3b8', fontSize: '0.85rem', textDecoration: 'none' }}>← Todas las corridas</Link>
      <FlowClient flow={flow} />
    </div>
  );
}
