import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guards';
import { buildRunFlow, callUsd, traceCalls, RunFlow } from './run-flow';

/** Admin only (ADMIN or SUPERADMIN): null for anyone else. */
export async function flowAdmin() {
  try { return await requireAdmin(); } catch { return null; }
}

export interface FlowRunRow {
  id: string; submissionId: string; status: string; stage: string; createdAt: string; updatedAt: string;
  firm: string; practice: string; owner: string; calls: number; usd: number; steps: number; issue: string;
}

/** The latest jobs of every user, summarised from their ledgers (no case content is read). */
export async function listFlowRuns(limit = 80): Promise<FlowRunRow[]> {
  if (!(await flowAdmin())) return [];
  const rows: any[] = await prisma.$queryRaw`
    SELECT j."id", j."submissionId", j."status", j."stage", j."createdAt", j."updatedAt", j."ledger", j."issue",
           s."practiceArea" AS practice,
           COALESCE(s."chambersData"->>'firm_name', s."chambersData"->>'firmName', '') AS firm,
           COALESCE(u."name", u."email", '') AS owner
      FROM "EditorialJob" j
      JOIN "Submission" s ON s."id" = j."submissionId"
      LEFT JOIN "User" u ON u."id" = j."userId"
     ORDER BY j."createdAt" DESC
     LIMIT ${limit}`;
  return rows.map(row => {
    const ledger = Array.isArray(row.ledger) ? row.ledger : [];
    const calls = ledger.flatMap((entry: any) => traceCalls(entry?.trace));
    return {
      id: String(row.id), submissionId: String(row.submissionId), status: String(row.status), stage: String(row.stage),
      createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
      firm: String(row.firm || ''), practice: String(row.practice || ''), owner: String(row.owner || ''),
      calls: calls.length, usd: calls.reduce((sum: number, call: any) => sum + callUsd(call), 0), steps: ledger.length,
      issue: row.issue?.message ? String(row.issue.message).slice(0, 160) : '',
    };
  });
}

/** One job and only the parts of its case the flow reads (never the documents themselves). */
export async function loadRunFlow(jobId: string): Promise<RunFlow | null> {
  if (!(await flowAdmin())) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) return null;
  const rows: any[] = await prisma.$queryRaw`
    SELECT j."id", j."submissionId", j."userId", j."status", j."stage", j."tasks", j."cursor", j."ledger", j."issue",
           j."createdAt", j."updatedAt", s."practiceArea" AS practice, COALESCE(u."name", u."email", '') AS owner,
           jsonb_build_object(
             'firm_name', COALESCE(s."chambersData"->>'firm_name', s."chambersData"->>'firmName', ''),
             'practice_area', s."chambersData"->'practice_area',
             'release_verdict', s."chambersData"->'release_verdict',
             'review_checkpoint', jsonb_build_object('state', s."chambersData"->'review_checkpoint'->'state'),
             'approved_artifact', (s."chambersData"->'approved_artifact') IS NOT NULL AND s."chambersData"->'approved_artifact' <> 'null'::jsonb,
             'available_artifact', (s."chambersData"->'available_artifact') IS NOT NULL AND s."chambersData"->'available_artifact' <> 'null'::jsonb,
             'draft_artifact', (s."chambersData"->'draft_artifact') IS NOT NULL AND s."chambersData"->'draft_artifact' <> 'null'::jsonb
           ) AS data
      FROM "EditorialJob" j
      JOIN "Submission" s ON s."id" = j."submissionId"
      LEFT JOIN "User" u ON u."id" = j."userId"
     WHERE j."id" = ${jobId}
     LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  return buildRunFlow(row, row.data || {}, { practice: String(row.practice || ''), owner: String(row.owner || '') });
}
