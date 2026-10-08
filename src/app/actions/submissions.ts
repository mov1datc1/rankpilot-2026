'use server';

import { recordAuditAction, normalizeRefereeNotes, supplementMatter, auditInputChanged, auditActions } from '@/lib/audit/next-actions';
import { previousApprovedArtifact } from '@/lib/audit/artifact-binding';

import { normalizeFilingDetails } from '@/lib/audit/filing-details';

import { recordReviewResponse } from '@/lib/audit/review-actions';
import { projectConfirmedLawyerRole } from '@/lib/audit/lawyer-role';
import { persistInputReview, validValueResolution } from '@/lib/audit/input-review';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

// ── Helper: Get authenticated user or throw ──
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Si existe en Prisma por email pero con otro ID (para evitar errores de UNIQUE constraint)
  if (user.email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
    if (existingByEmail && existingByEmail.id !== user.id) {
      return { ...user, id: existingByEmail.id };
    }
  }

  // Auto-sync Supabase Auth user to Prisma User table
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email || 'unknown@email.com',
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  return user;
}

export async function createSubmission(data: {
  targetDirectory: string;
  practiceArea: string;
  guideRegion: string;
  currentBand?: string;
  deadline?: string;
  primaryObjective?: string;
  secondaryObjective?: string;
}) {
  try {
    const user = await getAuthenticatedUser();

    // v13.0: Store objectives in chambersData JSON field
    const chambersData = {
      primaryObjective: data.primaryObjective,
      secondaryObjective: data.secondaryObjective,
    };

    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        targetDirectory: data.targetDirectory,
        practiceArea: data.practiceArea,
        guideRegion: data.guideRegion,
        currentBand: data.currentBand || '',
        deadline: data.deadline ? new Date(data.deadline) : null,
        status: 'Draft',
        chambersData: chambersData as any,
      }
    });

    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error creating submission:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserSubmissions() {
  try {
    const user = await getAuthenticatedUser();

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: submissions };
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSubmissionStatus(id: string, status: string, score?: number) {
  try {
    const user = await getAuthenticatedUser();

    // Validar ownership
    const existing = await prisma.submission.findUnique({
      where: { id }
    });

    if (!existing || existing.userId !== user.id) {
      throw new Error('No tienes permiso para actualizar este submission.');
    }

    const dataToUpdate: any = { status };
    if (score !== undefined) {
      dataToUpdate.completenessScore = score;
    }
    
    // Status tracking
    if (status === 'Submitted' && !existing.submittedAt) dataToUpdate.submittedAt = new Date();
    if (status === 'Accepted' && !existing.acceptedAt) dataToUpdate.acceptedAt = new Date();
    if (status === 'Rejected' && !existing.rejectedAt) dataToUpdate.rejectedAt = new Date();

    const submission = await prisma.submission.update({
      where: { id },
      data: dataToUpdate
    });
    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error updating submission:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Submission Department Data (Chambers Sections A4, B, C) ──
export async function updateSubmissionDepartment(submissionId: string, deptData: {
  contacts: { name: string; email: string; phone: string }[];
  departmentName: string;
  numPartners: number;
  numLawyers: number;
  departmentHeads: { name: string; email: string; phone: string }[];
  hires: { name: string; status: string; firm: string }[];
  lawyers: {
    name: string; url: string; currentRank: string; suggestedRank: string;
    focus: string; bio: string; standoutWork: string; isPartner: boolean; isRanked: boolean;
  }[];
  departmentDesc: string;
  feedback: string;
}) {
  try {
    const user = await getAuthenticatedUser();
    const existing = await prisma.submission.findUnique({ where: { id: submissionId } });

    if (!existing || existing.userId !== user.id) {
      throw new Error('No tienes permiso para actualizar este submission.');
    }

    const existingData = (existing.chambersData as any) || {};

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        chambersData: {
          ...existingData,
          contacts: deptData.contacts,
          departmentName: deptData.departmentName,
          numPartners: deptData.numPartners,
          numLawyers: deptData.numLawyers,
          departmentHeads: deptData.departmentHeads,
          hires: deptData.hires,
          lawyers: deptData.lawyers,
          departmentDesc: deptData.departmentDesc,
          feedback: deptData.feedback,
        }
      }
    });

    return { success: true, data: submission };
  } catch (error: any) {
    console.error('Error updating department data:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Validated Submission Data (Post-Ingestion Wizard) ──
export async function updateSubmissionValidatedData(submissionId: string, data: {
  expectedRevision?: number;
  reviewIssueMessage?: string;
  auditActionId?: string;
  refereeNotes?: string;
  firmName?: string;
  practiceArea?: string;
  location?: string;
  b10Text?: string;
  confirmedSourceB10?: string;
  researchPeriod?: { from: string; to: string };
  filingDetails?: unknown;
  lawyers?: any[];
  matters?: any[];
}) {
  try {
    const user = await getAuthenticatedUser();
    const existing = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!existing || existing.userId !== user.id) {
      throw new Error('No tienes permiso para actualizar este submission.');
    }

    const chambers = (existing.chambersData as any) || {};
    if (data.expectedRevision !== undefined && data.expectedRevision !== Number(chambers.draft_revision || 0)) {
      throw new Error('Hay una versión más reciente del borrador. Recarga antes de guardar para no sobrescribirla.');
    }
    if(data.auditActionId && !auditActions(chambers.editorial_review?.letter).some(a=>a.id===data.auditActionId)) throw new Error('Esta recomendación cambió. Vuelve al Audit actualizado.');
    if (data.researchPeriod) {
      const {from,to}=data.researchPeriod;
      const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
      if(!valid(from) || !valid(to) || from>to) throw new Error('Indica un periodo de trabajo válido.');
    }
    if (data.matters) data.matters = data.matters.map(m => {
      const previous = chambers.matters?.find((saved: any) => saved.id === m.id);
      const reviewed = persistInputReview(supplementMatter(m,previous,user.id), previous);
      if (validValueResolution(reviewed)) {
        const unchanged = previous?.valueResolution?.value === reviewed.valueResolution.value && previous?.valueResolution?.reason === reviewed.valueResolution.reason;
        reviewed.valueResolution = {...reviewed.valueResolution,
          confirmedAt: unchanged ? previous.valueResolution.confirmedAt : new Date().toISOString(),
          confirmedBy: unchanged ? previous.valueResolution.confirmedBy : user.id};
      }
      return reviewed;
    });
    if (data.lawyers) data.lawyers = data.lawyers.map(lawyer => {
      const previous = chambers.lawyers?.find((saved:any) => (saved.name || saved.fullName) === (lawyer.name || lawyer.fullName));
      const changed = previous && (previous.role !== lawyer.role || previous.isPartner !== lawyer.isPartner);
      if (!changed && !lawyer.roleResolution) return lawyer;
      const resolution = lawyer.roleResolution || {role:lawyer.role || '',reason:'',confirmed:false};
      const valid = resolution.confirmed === true && !!resolution.reason?.trim() && resolution.role === lawyer.role && lawyer.isPartner === (lawyer.role === 'Partner');
      const unchanged = previous?.roleResolution?.confirmed === true && previous.roleResolution.role === resolution.role && previous.roleResolution.reason === resolution.reason;
      return projectConfirmedLawyerRole({...lawyer,is_partner:lawyer.isPartner,roleResolution:{...resolution,confirmed:valid,
        originalRole:previous?.roleResolution?.originalRole ?? previous?.role ?? (previous?.isPartner === true ? 'Partner' : previous?.isPartner === false ? 'Associate' : null),
        confirmedAt:valid ? (unchanged ? previous.roleResolution.confirmedAt : new Date().toISOString()) : null,
        confirmedBy:valid ? (unchanged ? previous.roleResolution.confirmedBy : user.id) : null}});
    });
    const filingDetails = data.filingDetails ? normalizeFilingDetails(data.filingDetails) : null;
    const onlyFiling=filingDetails && Object.keys(data).every(key=>['expectedRevision','auditActionId','filingDetails'].includes(key));
    if(onlyFiling && !auditInputChanged(chambers,{...chambers,...filingDetails},'filing')) {
      return {success:true,unchanged:true,revision:Number(chambers.draft_revision || 0),filingDetails};
    }
    const nextRevision = Number(chambers.draft_revision || 0) + 1;
    const updatedChambers = {
      ...chambers,
      ...(filingDetails || {}),
      draft_revision: nextRevision,
      previous_approved_artifact: previousApprovedArtifact(existing,chambers),
      ...(data.refereeNotes !== undefined ? {audit_referee_notes:normalizeRefereeNotes(data.refereeNotes)} : {}),
      final_review_stale: true,
      ...(data.practiceArea && data.practiceArea !== existing.practiceArea ? { canonical_matter_selection: null } : {}),
      release_verdict: { passed: false, status: 'needs_review', errors: ['Draft edited; validation required.'] },
      cloned_docx_b64: null,
      approved_artifact: null,
      ...(data.firmName ? { firm_name: data.firmName, firmName: data.firmName } : {}),
      ...(data.b10Text !== undefined ? { enhanced_b7: data.b10Text, b7: data.b10Text } : {}),
      ...(data.confirmedSourceB10 !== undefined ? { confirmed_source_b10: data.confirmedSourceB10 } : {}),
      ...(data.researchPeriod ? { research_period: {...data.researchPeriod,source:'User-confirmed submission instructions'} } : {}),
      ...(data.lawyers ? { lawyers: data.lawyers } : {}),
      ...(data.matters ? { matters: data.matters } : {})
    };

    Object.assign(updatedChambers, {audit_action_responses:recordAuditAction(chambers,updatedChambers,data.auditActionId,user.id)});
    Object.assign(updatedChambers, {review_responses:recordReviewResponse(chambers,updatedChambers,data.reviewIssueMessage,user.id)});

    await prisma.$transaction(async (tx) => {
    const locked = await tx.submission.updateMany({ where: { id: submissionId, updatedAt: existing.updatedAt }, data: { updatedAt: new Date() } });
    if (locked.count !== 1) throw new Error('El borrador cambió en otra operación. Recarga antes de guardar.');
    if (data.matters && Array.isArray(data.matters)) {
      for (const m of data.matters) {
        if (m.id && !m.id.startsWith('matter-ext-') && !m.id.startsWith('matter-')) {
          await tx.matter.updateMany({
            where: { id: m.id, submissionId },
            data: {
              name: m.name || m.title || '',
              optimizedText: m.optimizedText || m.optimized_text || '',
              ...(m.status === 'Draft' ? {status: 'Draft'} : {}),
              teamMembers: m.teamMembers || m.team_members || '',
              crossBorder: m.crossBorder || '',
              completionDate: m.completionDate || '',
              otherFirms: m.otherFirms || '',
              client: m.client || '',
              value: m.value || '',
              leadPartner: m.leadPartner || m.lead_partner || '',
              isConfidential: m.isConfidential ?? false,
              rawNotes: m.rawNotes || m.summary || ''
            }
          });
        }
      }
    }

    await tx.submission.update({
      where: { id: submissionId },
      data: {
        chambersData: updatedChambers,
        ...(data.practiceArea ? { practiceArea: data.practiceArea } : {}),
        updatedAt: new Date()
      }
    });

    });
    return { success: true, revision: nextRevision, auditActionResponses:(updatedChambers as any).audit_action_responses, refereeNotes:(updatedChambers as any).audit_referee_notes, previousApprovedArtifact:updatedChambers.previous_approved_artifact, filingDetails, matters: data.matters, lawyers: data.lawyers, reviewResponses: (updatedChambers as any).review_responses };
  } catch (error: any) {
    console.error('Error updating validated data:', error);
    return { success: false, error: error.message };
  }
}

// ── Designate Hero / Insignia Matter ──
export async function updateDesignatedHeroMatter(submissionId: string, heroMatterId: string, heroMatterTitle: string) {
  try {
    const user = await getAuthenticatedUser();
    const existing = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!existing || existing.userId !== user.id) {
      throw new Error('No tienes permiso para actualizar este submission.');
    }

    const chambers = (existing.chambersData as any) || {};
    const narrativeArch = chambers.narrative_architecture || {};
    const updatedChambers = {
      ...chambers,
      draft_revision: Number(chambers.draft_revision || 0)+1,
      approved_artifact: null,
      release_verdict: {passed:false,status:'needs_review'},
      user_selected_hero_id: heroMatterId,
      hero_matter_id: heroMatterId,
      hero_matter_title: heroMatterTitle,
      hero_matter_name: heroMatterTitle,
      narrative_architecture: {
        ...narrativeArch,
        hero_matter: heroMatterTitle
      },
      canonical_matter_selection: {
        ...(chambers.canonical_matter_selection || {}),
        hero_matter_id: heroMatterId,
        hero_matter_title: heroMatterTitle
      }
    };

    const saved = await prisma.submission.updateMany({
      where: { id: submissionId, updatedAt: existing.updatedAt },
      data: {
        chambersData: updatedChambers,
        updatedAt: new Date()
      }
    });

    if (saved.count !== 1) throw new Error('El borrador cambió. Recarga antes de seleccionar la insignia.');
    return { success: true, revision: updatedChambers.draft_revision };
  } catch (error: any) {
    console.error('Error updating hero matter:', error);
    return { success: false, error: error.message };
  }
}

