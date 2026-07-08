'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function createMatter(data: {
  submissionId: string;
  name: string;
  client: string;
  value: string;
  leadPartner: string;
  rawNotes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Opcional: Validar que la submission pertenezca al usuario
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

export async function getMattersBySubmission(submissionId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
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

export async function updateMatterOptimization(id: string, optimizedText: string) {
  try {
    const matter = await prisma.matter.update({
      where: { id },
      data: { optimizedText, status: 'AI Optimized' }
    });
    return { success: true, data: matter };
  } catch (error: any) {
    console.error('Error updating matter:', error);
    return { success: false, error: error.message };
  }
}

export async function optimizeMatterWithAI(matterId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // 1. Fetch the matter
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

    // 2. Setup Python API URL
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000/process';

    // 3. Construct the prompt for the Python LangChain orchestrator
    const userPrompt = `
Eres un consultor experto en directorios legales (Chambers/Legal 500).
Por favor optimiza el siguiente caso para un formulario de submission:
- Nombre del Proyecto: ${matter.name}
- Cliente: ${matter.client}
- Valor: ${matter.value}
- Socio Líder: ${matter.leadPartner}

Notas Crudas del Abogado:
${matter.rawNotes}

Escribe un solo párrafo profesional y objetivo (aprox 100-150 palabras) enfocado en complejidad e innovación. No incluyas corchetes ni placeholders, solo el texto final.`;

    // 4. Call Python Backend API
    const response = await fetch(pythonApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_input: userPrompt,
        thread_id: matterId, // Usamos el ID del matter como thread de conversacion
        is_file: false
      })
    });

    if (!response.ok) {
      throw new Error(`Python API error: Status ${response.status}`);
    }

    const data = await response.json();
    
    // El backend de Python retorna data.data.response con el contenido final
    let generatedText = "Error: El servidor Python no devolvió texto.";
    if (data && data.data && data.data.response) {
      generatedText = data.data.response.trim();
    }

    // 5. Save the optimized text
    const updatedMatter = await prisma.matter.update({
      where: { id: matterId },
      data: { 
        optimizedText: generatedText,
        status: 'AI Optimized'
      }
    });

    return { success: true, data: updatedMatter };
  } catch (error: any) {
    console.error('Error optimizing matter with Python AI:', error);
    return { success: false, error: error.message };
  }
}
