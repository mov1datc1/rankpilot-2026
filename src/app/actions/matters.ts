'use server';

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

// ── Create Matter ──
export async function createMatter(data: {
  submissionId: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes?: string;
  isConfidential?: boolean;
  crossBorder?: string;
  teamMembers?: string;
  otherFirms?: string;
  completionDate?: string;
  otherInfo?: string;
  isNewClient?: boolean;
}) {
  try {
    const user = await getAuthenticatedUser();

    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId }
    });

    if (!submission || submission.userId !== user.id) {
      throw new Error('No tienes permiso para agregar casos a este proyecto.');
    }

    const matter = await prisma.matter.create({
      data: {
        submissionId: data.submissionId,
        userId: user.id,
        name: data.name,
        client: data.client,
        value: data.value,
        leadPartner: data.leadPartner,
        rawNotes: data.rawNotes,
        status: 'Draft',
        source: 'builder',
        isConfidential: data.isConfidential || false,
        crossBorder: data.crossBorder || '',
        teamMembers: data.teamMembers || '',
        otherFirms: data.otherFirms || '',
        completionDate: data.completionDate || '',
        otherInfo: data.otherInfo || '',
        isNewClient: data.isNewClient || false,
      }
    });

    return { success: true, data: matter };
  } catch (error: any) {
    console.error('Error creating matter:', error);
    return { success: false, error: error.message };
  }
}

// ── Get Matters by Submission ──
export async function getMattersBySubmission(submissionId: string) {
  try {
    const user = await getAuthenticatedUser();

    // Validate ownership
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (!submission || submission.userId !== user.id) {
      return { success: false, error: 'No tienes permiso para ver estos casos.' };
    }

    const matters = await prisma.matter.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: matters };
  } catch (error: any) {
    console.error('Error fetching matters:', error);
    return { success: false, error: error.message };
  }
}

// ── Get All Matters for User ──
export async function getAllUserMatters() {
  try {
    const user = await getAuthenticatedUser();

    const matters = await prisma.matter.findMany({
      where: { userId: user.id },
      include: {
        submission: {
          select: {
            id: true,
            targetDirectory: true,
            practiceArea: true,
            createdAt: true,
            chambersData: true,
          }
        },
        firm: {
          select: {
            id: true,
            name: true
          }
        },
        sources: {
          select: {
            id: true,
            fileName: true,
            fileType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: matters };
  } catch (error: any) {
    console.error('Error fetching all user matters:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Matter Optimization (with ownership check) ──
export async function updateMatterOptimization(id: string, optimizedText: string) {
  try {
    const user = await getAuthenticatedUser();

    // Validate ownership through submission chain
    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para modificar este caso.');
    }

    const updated = await prisma.matter.update({
      where: { id },
      data: { optimizedText, status: 'AI Optimized' }
    });
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error updating matter:', error);
    return { success: false, error: error.message };
  }
}

// ── Delete Matter ──
export async function deleteMatter(id: string) {
  try {
    const user = await getAuthenticatedUser();

    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para eliminar este caso.');
    }

    await prisma.matter.delete({
      where: { id }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting matter:', error);
    return { success: false, error: error.message };
  }
}

// ── Update Matter Inline ──
export async function updateMatterInline(id: string, data: { name?: string; client?: string; value?: string }) {
  try {
    const user = await getAuthenticatedUser();

    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para editar este caso.');
    }

    const updated = await prisma.matter.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.client !== undefined && { client: data.client }),
        ...(data.value !== undefined && { value: data.value }),
      }
    });

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error updating matter inline:', error);
    return { success: false, error: error.message };
  }
}

// ── Optimize Matter with AI (with logging + rate limiting + thread persistence) ──
export async function optimizeMatterWithAI(matterId: string) {
  try {
    const user = await getAuthenticatedUser();
    const startTime = Date.now();

    // 1. Fetch the matter with ownership validation
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      include: { submission: true }
    });

    if (!matter || matter.userId !== user.id) {
      throw new Error('No tienes permiso para optimizar este caso.');
    }

    if (!matter.rawNotes || matter.rawNotes.trim().length === 0) {
      throw new Error('No hay notas crudas para optimizar.');
    }

    // 2. Rate limiting: Check if this matter was optimized in the last 30 seconds
    const recentLog = await prisma.aILog.findFirst({
      where: {
        matterId: matterId,
        createdAt: { gte: new Date(Date.now() - 30000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentLog) {
      throw new Error('Por favor espera 30 segundos antes de optimizar este caso nuevamente.');
    }

    // 3. Setup Python API URL
    const pythonBaseUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
    const pythonApiUrl = `${pythonBaseUrl.replace(/\/$/, '')}/process`;

    const targetDir = (matter.submission?.targetDirectory || 'Chambers').trim();
    const isL500 = targetDir.toLowerCase().includes('500') || targetDir.toLowerCase().includes('legal');
    const practice = matter.submission?.practiceArea || 'General Practice';

    // 4. Construct the prompt following Angela Castillo's benchmark methodology
    const userPrompt = isL500
      ? `Eres un consultor editorial senior para The Legal 500 (${practice}).
Por favor optimiza el siguiente asunto para el formulario oficial de The Legal 500:
- Nombre del Asunto: ${matter.name}
- Cliente: ${matter.client}
- Valor / Cuantía / Magnitud: ${matter.value || 'No especificado'}
- Abogado(s) Líder(es) / Equipo: ${matter.leadPartner || 'No especificado'}

Notas Crudas del Abogado:
${matter.rawNotes}

DIRECTRICES EDITORIALES THE LEGAL 500 (Estándar de Oro):
1. ENFOQUE EN EXCELENCIA DE EJECUCIÓN ("Delivery Excellence"): The Legal 500 prioriza la capacidad operativa práctica, la respuesta comercial ágil y la integración con el cliente sobre el mero prestigio transaccional.
2. ESTRUCTURA FLUIDA: Redacta 2-3 párrafos continuos y elegantes. Aplica "Zero Carpentry": CERO etiquetas visibles o encabezados en negrita (NO uses "**Contexto:**", "**Impacto:**" ni viñetas).
3. PROFUNDIDAD DEL EQUIPO ("Team Depth"): Destaca la participación del socio líder y de los asociados sénior para evidenciar consistencia en toda la estructura del despacho.
4. RIGOR PROBATORIO: Basa el texto en hechos verificables, clientes corporativos y magnitud operativa sin lenguaje inflado ni adjetivos vacíos.`
      : `Eres un consultor editorial senior para Chambers and Partners (${practice}).
Por favor optimiza el siguiente asunto para Chambers:
- Nombre del Asunto: ${matter.name}
- Cliente: ${matter.client}
- Valor / Cuantía / Magnitud: ${matter.value || 'No especificado'}
- Socio Líder: ${matter.leadPartner || 'No especificado'}

Notas Crudas del Abogado:
${matter.rawNotes}

DIRECTRICES EDITORIALES DE ÁNGELA CASTILLO / CHAMBERS GOLD STANDARD:
1. ZERO CARPENTRY: Estricto estándar de 3 párrafos orgánicos y fluidos. CERO etiquetas visibles (NO uses "**Contexto:**", "**Impacto:**", "**Resultado:**" ni viñetas).
2. PÁRRAFO 1 (Contexto & Riesgo Existencial): Coloca la transacción corporativa, adquisición o el conflicto de mayor riesgo en la PRIMERA ORACIÓN para que el researcher sepa de inmediato por qué está leyendo esto. Establece la escala (empleados afectados, cuantía o alcance geográfico/multi-planta).
3. PÁRRAFO 2 (Intervención Técnica Diferencial): Detalla el craft legal específico de la firma (armonización de estructuras laborales, litigio coordinado, amparo constitucional, negociaciones colectivas con sindicatos o gobernanza regulatoria).
4. PÁRRAFO 3 (Resultado, Expansión & Abogado): Cuantifica el desenlace concreto (contingencia evitada, litigios resueltos, continuidad operativa blindada), la continuidad de la relación institucional y la atribución explícita al socio líder (${matter.leadPartner || 'el socio líder'}).
5. ZERO INFLATED CLAIMS: Prohibido usar frases infladas como "establishing a precedent" o autoelogios vacíos a menos que exista una resolución constitucional o jurisprudencia vinculante formalmente acreditada.`;

    // 5. Call Python Backend API
    const response = await fetch(pythonApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: userPrompt,
        thread_id: matter.threadId || matterId,
        is_file: false
      })
    });

    if (!response.ok) {
      throw new Error(`Python API error: Status ${response.status}`);
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    let generatedText = "Error: El servidor Python no devolvio texto.";
    if (data && data.data && data.data.response) {
      generatedText = data.data.response.trim();
    }

    // 6. Persist thread_id from Python for future conversations
    const returnedThreadId = data.thread_id || matterId;

    // 7. Save the optimized text + thread_id
    const updatedMatter = await prisma.matter.update({
      where: { id: matterId },
      data: {
        optimizedText: generatedText,
        status: 'AI Optimized',
        threadId: returnedThreadId
      }
    });

    // 8. Log the AI interaction for traceability
    await prisma.aILog.create({
      data: {
        userId: user.id,
        matterId: matterId,
        prompt: userPrompt,
        response: generatedText,
        durationMs: durationMs
      }
    });

    return { success: true, data: updatedMatter };
  } catch (error: any) {
    console.error('Error optimizing matter with Python AI:', error);
    return { success: false, error: error.message };
  }
}

// ── Delete Case Folder (Submission + all its matters) ──
export async function deleteCaseFolder(data: {
  submissionId?: string;
  matterIds: string[];
}) {
  try {
    const user = await getAuthenticatedUser();

    // Step 1: Delete all matters in the folder
    if (data.matterIds.length > 0) {
      // Verify ownership of all matters
      const matters = await prisma.matter.findMany({
        where: { id: { in: data.matterIds } },
      });

      const unauthorized = matters.filter(m => m.userId !== user.id);
      if (unauthorized.length > 0) {
        throw new Error('No tienes permiso para eliminar algunos de estos casos.');
      }

      // Delete MatterSources first (child records)
      await prisma.matterSource.deleteMany({
        where: { matterId: { in: data.matterIds } },
      });

      // Delete the matters themselves
      await prisma.matter.deleteMany({
        where: { id: { in: data.matterIds }, userId: user.id },
      });
    }

    // Step 2: Delete the submission if it exists (builder folders)
    if (data.submissionId) {
      const submission = await prisma.submission.findUnique({
        where: { id: data.submissionId },
        include: { matters: { select: { id: true } } },
      });

      if (submission && submission.userId === user.id) {
        // Delete any remaining matters linked to this submission
        if (submission.matters.length > 0) {
          await prisma.matterSource.deleteMany({
            where: { matterId: { in: submission.matters.map(m => m.id) } },
          });
          await prisma.matter.deleteMany({
            where: { submissionId: data.submissionId },
          });
        }

        // Delete the submission
        await prisma.submission.delete({
          where: { id: data.submissionId },
        });
      }
    }

    return { success: true, deletedCount: data.matterIds.length };
  } catch (error: any) {
    console.error('Error deleting case folder:', error);
    return { success: false, error: error.message };
  }
}
