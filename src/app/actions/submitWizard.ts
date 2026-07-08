'use server';

export async function submitWizardData(formData: any) {
  try {
    // Formatting the Wizard JSON into a structured prompt for the AI
    const structuredInput = `
# RankPilot Submission Data

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
        // Using a random thread_id for this session to track conversational state if needed
        thread_id: `wizard_${Date.now()}`
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor de IA: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in submitWizardData:', error);
    return { success: false, error: error.message };
  }
}
