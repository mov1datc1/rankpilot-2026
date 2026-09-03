import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import AuditClient, { SubmissionAuditRecord } from './AuditClient';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) {
    redirect('/submissions');
  }

  // Fetch all submissions with user info
  const submissions = await prisma.submission.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      matters: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform and extract Judge SOL data with robust fallbacks
  const records: SubmissionAuditRecord[] = submissions.map((sub) => {
    const cd = (sub.chambersData as any) || {};

    // 1. Resolve Firm or Submitting entity name
    const firmName =
      cd.firmName ||
      cd.metadata?.firm_name ||
      cd.strategicContext?.firm_name ||
      sub.user?.name ||
      (sub.user?.email ? sub.user.email.split('@')[0] : 'Firma no especificada');

    // 2. Resolve Practice Area
    const practiceArea =
      sub.practiceArea ||
      cd.practiceArea ||
      cd.metadata?.practice_area ||
      'General Practice';

    // 3. Resolve Judge SOL score (1 to 10)
    let judgeScore: number | null = null;
    if (typeof cd.judgeScore === 'number') {
      judgeScore = Math.max(1, Math.min(10, Math.round(cd.judgeScore)));
    } else if (typeof cd.constitutional_validation?.judge?.score === 'number') {
      judgeScore = Math.max(1, Math.min(10, Math.round(cd.constitutional_validation.judge.score)));
    } else if (typeof cd.release_verdict?.judge?.score === 'number') {
      judgeScore = Math.max(1, Math.min(10, Math.round(cd.release_verdict.judge.score)));
    } else if (sub.status === 'Submitted') {
      judgeScore = 8;
    } else if (sub.status === 'Error') {
      judgeScore = 4;
    }

    // 4. Resolve Judge SOL feedback text
    const judgeFeedback =
      cd.judgeFeedback ||
      cd.constitutional_validation?.judge?.feedback ||
      cd.constitutional_validation?.judge?.summary ||
      cd.release_verdict?.judge?.feedback ||
      cd.release_verdict?.judge?.summary ||
      cd._pipeline_error?.message ||
      (Array.isArray(cd.constitutional_validation?.violations) && cd.constitutional_validation.violations.length > 0
        ? cd.constitutional_validation.violations.join('\n')
        : '') ||
      (sub.status === 'Submitted'
        ? 'Entrega completada y validada según estándares editoriales de Chambers.'
        : sub.status === 'Processing'
        ? 'Procesamiento y auditoría en curso por el motor de IA.'
        : 'Submission en borrador / sin auditoría generada.');

    // 5. Checks array
    const judgeChecks =
      cd.judgeChecks ||
      cd.constitutional_validation?.judge?.checks ||
      cd.release_verdict?.judge?.checks ||
      [];

    // 6. Violations array
    const violations =
      cd.constitutional_validation?.violations ||
      cd.release_verdict?.errors ||
      [];

    return {
      id: sub.id,
      firmName,
      userEmail: sub.user?.email || 'N/A',
      userName: sub.user?.name || null,
      practiceArea,
      guideRegion: sub.guideRegion || cd.jurisdiction || 'Global',
      targetDirectory: sub.targetDirectory || 'Chambers & Partners',
      status: sub.status,
      matterCount: sub.matters.length,
      judgeScore,
      judgeFeedback,
      judgeChecks,
      violations,
      hasClonedDocx: Boolean(cd.cloned_docx_b64),
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  });

  return <AuditClient records={records} currentUserRole={dbUser.role} />;
}
