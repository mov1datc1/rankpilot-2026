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
        name: data.name,
        client: data.client,
        value: data.value,
        leadPartner: data.leadPartner,
        rawNotes: data.rawNotes,
        status: 'Draft'
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

// ── Update Matter Optimization (with ownership check) ──
export async function updateMatterOptimization(id: string, optimizedText: string) {
  try {
    const user = await getAuthenticatedUser();

    // Validate ownership through submission chain
    const matter = await prisma.matter.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!matter || matter.submission.userId !== user.id) {
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

    if (!matter || matter.submission.userId !== user.id) {
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
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000/process';

    // 4. Construct the prompt
    const userPrompt = `
Eres un consultor experto en directorios legales (Chambers/Legal 500).
Por favor optimiza el siguiente caso para un formulario de submission:
- Nombre del Proyecto: ${matter.name}
- Cliente: ${matter.client}
- Valor: ${matter.value}
- Socio Lider: ${matter.leadPartner}

Notas Crudas del Abogado:
${matter.rawNotes}

Escribe un solo parrafo profesional y objetivo (aprox 100-150 palabras) enfocado en complejidad e innovacion. No incluyas corchetes ni placeholders, solo el texto final.`;

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
