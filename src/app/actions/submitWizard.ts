'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function submitWizardData(formData: any) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

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
        targetDirectory: formData.practice || 'Chambers',
        practiceArea: formData.practice || 'General',
        guideRegion: formData.jurisdiction || 'Global',
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

    // 3. Formatting the Wizard JSON into a structured prompt for the AI
    const structuredInput = `
# RankPilot Submission Data (ID: ${newSubmission.id})

## 1. Información Preliminar
- Firma: ${formData.firmName}
- Jurisdicción: ${formData.jurisdiction}
- Práctica: ${formData.practice}
- Periodo: ${formData.period}

## 2. Detalles del Departamento
- Descripción: ${formData.departmentDesc}
- Tamaño del Equipo: ${formData.teamSize || 'N/A'}
- Especialidades: ${formData.specialties || 'N/A'}

## 3. Fortalezas Destacadas
- Logros: ${formData.keyAchievements || 'N/A'}
- Casos Relevantes: ${formData.relevantCases || 'N/A'}
- Diferenciadores: ${formData.differentiators || 'N/A'}

## 4. Feedback y Contexto
- Feedback: ${formData.feedback || 'N/A'}
- Enfoque Estratégico: ${formData.strategicFocus || 'N/A'}

## 5. Clientes y Casos
- Clientes: ${formData.clients || 'N/A'}
- Descripciones de Casos: ${formData.caseDescriptions || 'N/A'}
    `.trim();

    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';

    // Call the Python FastAPI endpoint (as defined in main.py)
    const response = await fetch(`${pythonApiUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_input: structuredInput,
        is_file: false,
        thread_id: newSubmission.id, // Using the real submission ID
        context: {
          directory: formData.practice || 'Chambers',
          jurisdiction: formData.jurisdiction || 'Global',
          practice_area: formData.practice || 'General',
          current_status: 'N/A'
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor de IA: ${response.statusText}`);
    }

    const data = await response.json();

    // Persist AI analysis and strategic_context back into chambersData
    const aiAnalysis = data?.data?.analysis || {};
    const aiStrategicContext = data?.data?.strategic_context || {};
    const aiMatters = data?.data?.matters || [];

    await prisma.submission.update({
      where: { id: newSubmission.id },
      data: {
        chambersData: {
          ...formData,
          analysis: aiAnalysis,
          strategicContext: aiStrategicContext
        },
        status: 'Submitted'
      }
    });

    return { success: true, data, submissionId: newSubmission.id };
  } catch (error: any) {
    console.error('Error in submitWizardData:', error);
    return { success: false, error: error.message };
  }
}
