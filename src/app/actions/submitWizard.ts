'use server';

import { selectedScope, scopeIssues } from '@/lib/audit/analysis-scope';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function submitWizardData(formData: any) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const issues=scopeIssues(selectedScope(formData));
    if(issues.length) return {success:false,error:issues.map(i=>i.message).join(' ')};

    // Resolve user ID by email to handle Supabase/Prisma ID mismatch
    let resolvedUserId = user.id;
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        resolvedUserId = existingByEmail.id;
      } else {
        // Auto-sync if user doesn't exist in Prisma yet
        await prisma.user.upsert({
          where: { id: user.id },
          update: {},
          create: { id: user.id, email: user.email, role: 'USER', status: 'ACTIVE' }
        });
      }
    }

    // 1. Create a real Submission in the DB
    const newSubmission = await prisma.submission.create({
      data: {
        userId: resolvedUserId,
        targetDirectory: formData.directory,
        practiceArea: formData.practice,
        guideRegion: formData.jurisdiction,
        currentBand: 'N/A',
        status: 'In Progress',
        chambersData: formData
      }
    });

    // 2. Clone associated matters (if any) to this new submission
    if (formData.associatedMatterIds && formData.associatedMatterIds.length > 0) {
      const mattersToClone = await prisma.matter.findMany({
        where: { id: { in: formData.associatedMatterIds }, userId: resolvedUserId }
      });
      
      for (const m of mattersToClone) {
        await prisma.matter.create({
          data: {
            submissionId: newSubmission.id,
            userId: resolvedUserId,
            name: m.name,
            client: m.client,
            value: m.value,
            leadPartner: m.leadPartner,
            rawNotes: m.rawNotes,
            optimizedText: m.optimizedText,
            status: m.status,
            threadId: m.threadId,
            source: 'builder',
          }
        });
      }
    }

    // The form creates source data. Studio owns the single editorial workflow.
    const matters=await prisma.matter.findMany({where:{submissionId:newSubmission.id}});
    await prisma.submission.update({where:{id:newSubmission.id},data:{status:'Draft',targetDirectory:formData.directory,currentBand:'',chambersData:{...formData,firm_name:formData.firmName || '',original_b10:formData.departmentDesc || '',research_period:formData.period || null,matters:matters.map(m=>({...m,confidentialityConfirmed:false,publish_status:'confirmation_required'}))}}});
    return {success:true,data:{data:{pdf_url:null}},submissionId:newSubmission.id};
  } catch (error: any) {
    console.error('Error in submitWizardData:', error);
    return { success: false, error: error.message };
  }
}
