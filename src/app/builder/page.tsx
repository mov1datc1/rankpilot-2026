'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { 
  Upload, 
  FileText, 
  FileCheck, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  FileSpreadsheet, 
  X, 
  Loader2, 
  Briefcase, 
  Target,
  FileCode,
  Edit2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSubmission } from '@/app/actions/submissions';
import { createClient } from '@/utils/supabase/client';
import PremiumSelect from '@/components/PremiumSelect';
import { 
  DIRECTORIES, 
  REGIONS, 
  PRACTICE_AREAS, 
  BANDS, 
  JURISDICTIONS, 
  SUBMISSION_OBJECTIVES 
} from '@/lib/constants';

type IngestionModality = 'draft' | 'scratch';

interface UploadedSourceFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Wizard Master Phase:
  // Phase 1: Modality Selection ('modality')
  // Phase 2: Strategic Calibration ('calibration')
  // Phase 3: Document Ingestion ('ingestion')
  const [currentPhase, setCurrentPhase] = useState<'modality' | 'calibration' | 'ingestion'>('modality');

  // Mode Selection: 'draft' (Structured template) vs 'scratch' (Dispersed docs/notes)
  const initialMode = (searchParams.get('mode') === 'scratch' ? 'scratch' : 'draft') as IngestionModality;
  const [modality, setModality] = useState<IngestionModality>(initialMode);

  // Strategic Calibration State (7 Guided Questions)
  const [calibrationSubStep, setCalibrationSubStep] = useState<number>(1);
  const totalCalibrationSteps = 7;

  const [targetDirectory, setTargetDirectory] = useState<string>('Chambers & Partners');
  const [country, setCountry] = useState<string>('Mexico');
  const [guideRegion, setGuideRegion] = useState<string>('Latin America');
  const [practiceArea, setPracticeArea] = useState<string>('Tax');
  const [currentBand, setCurrentBand] = useState<string>('Unranked');
  const [primaryObjective, setPrimaryObjective] = useState<string>('First-time recognition');
  const [secondaryObjective, setSecondaryObjective] = useState<string>('Highlight Cross-Border Mandates');

  // Draft Modality States (Single file or pasted text)
  const [draftMode, setDraftMode] = useState<'upload' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const draftFileInputRef = useRef<HTMLInputElement>(null);

  // Scratch / Multi-Doc Modality States
  const [sourceFiles, setSourceFiles] = useState<UploadedSourceFile[]>([]);
  const [freeformNotes, setFreeformNotes] = useState('');
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Build & Loading State
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStepText, setBuildStepText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Smart objective defaults based on band
  useEffect(() => {
    if (currentBand === 'Unranked') {
      setPrimaryObjective('First-time recognition');
    } else {
      setPrimaryObjective('Maintain current ranking');
    }
  }, [currentBand]);

  // File Handlers for Draft
  const handleDraftFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage('');
    }
  };

  // File Handlers for Multi-Doc
  const handleMultiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: UploadedSourceFile[] = Array.from(e.target.files).map(f => ({
        file: f,
        name: f.name,
        size: f.size,
        type: f.type
      }));
      setSourceFiles(prev => [...prev, ...newFiles]);
      setErrorMessage('');
    }
  };

  const removeSourceFile = (index: number) => {
    setSourceFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Build Submission Handler
  const handleBuildSubmission = async () => {
    setErrorMessage('');

    if (modality === 'draft') {
      if (draftMode === 'upload' && !selectedFile) {
        setErrorMessage('Por favor selecciona un archivo DOCX o DOC con el borrador.');
        return;
      }
      if (draftMode === 'paste' && !pastedText.trim()) {
        setErrorMessage('Por favor pega el texto del borrador de tu submission.');
        return;
      }
    } else {
      if (sourceFiles.length === 0 && !freeformNotes.trim()) {
        setErrorMessage('Por favor sube al menos un archivo o escribe notas con la información de los asuntos.');
        return;
      }
    }

    setIsBuilding(true);
    setBuildStepText('Inicializando submission e inyectando calibración estratégica...');

    try {
      // 1. Create Submission in DB
      const subRes = await createSubmission({
        targetDirectory,
        practiceArea,
        guideRegion: `${guideRegion} — ${country}`,
        currentBand,
        primaryObjective,
        secondaryObjective
      });

      if (!subRes.success || !subRes.data) {
        throw new Error(subRes.error || 'Error creando el registro del submission');
      }

      const submissionId = subRes.data.id;
      let primaryDocUrl = '';
      const sourcesPayload: Array<{ url: string; name: string; text?: string }> = [];

      // 2. Upload Files to Supabase Storage
      if (modality === 'draft' && draftMode === 'upload' && selectedFile) {
        setBuildStepText('Subiendo documento de borrador a almacenamiento seguro...');
        const ext = selectedFile.name.split('.').pop() || 'docx';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(`submissions/${fileName}`, selectedFile, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw new Error(`Fallo de subida: ${uploadErr.message}`);
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`submissions/${fileName}`);
        primaryDocUrl = publicUrl;
        sourcesPayload.push({ url: publicUrl, name: selectedFile.name });

      } else if (modality === 'scratch') {
        if (sourceFiles.length > 0) {
          setBuildStepText(`Subiendo ${sourceFiles.length} archivos fuente para consolidación...`);
          for (const sf of sourceFiles) {
            const ext = sf.name.split('.').pop() || 'file';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const { error: uErr } = await supabase.storage
              .from('documents')
              .upload(`sources/${fileName}`, sf.file, { cacheControl: '3600', upsert: true });

            if (!uErr) {
              const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`sources/${fileName}`);
              sourcesPayload.push({ url: publicUrl, name: sf.name });
            }
          }
        }

        if (freeformNotes.trim()) {
          sourcesPayload.push({
            url: '',
            name: 'Notas Adicionales y Correos Pegados',
            text: freeformNotes.trim()
          });
        }
      }

      // 3. Trigger Extraction via /api/extract-document
      setBuildStepText('Extrayendo entidades fácticas, narrativa B10 y roster B9 con IA...');
      const extractPayload: any = {
        submissionId,
        documentUrl: primaryDocUrl || (sourcesPayload.length > 0 ? sourcesPayload[0].url : ''),
        text: draftMode === 'paste' ? pastedText : (freeformNotes || ''),
        sources: sourcesPayload,
        context: {
          directory: targetDirectory,
          jurisdiction: `${guideRegion} — ${country}`,
          practiceArea,
          currentBand,
          sources: sourcesPayload
        }
      };

      const extRes = await fetch('/api/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractPayload)
      });

      const extJson = await extRes.json();
      if (!extRes.ok || !extJson.success) {
        throw new Error(extJson.error || 'El motor de extracción no pudo procesar los documentos.');
      }

      setBuildStepText('¡Extracción completada! Abriendo Asistente de Validación...');
      router.push(`/reports/${submissionId}?validate=true`);

    } catch (err: any) {
      console.error('[BUILDER ERROR]:', err);
      setErrorMessage(err.message || 'Ocurrió un error inesperado al construir el submission.');
      setIsBuilding(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header - Identical look & feel to Deliverables/Reports */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          RankPilot: <span style={{ color: '#2563eb' }}>Builder</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
          Construye y calibra tu submission de directorio paso a paso con inteligencia editorial.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '0.85rem 1.5rem',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Step 1 Pill */}
        <div 
          onClick={() => !isBuilding && setCurrentPhase('modality')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: !isBuilding ? 'pointer' : 'default',
            opacity: currentPhase === 'modality' ? 1 : 0.7
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: currentPhase === 'modality' ? '#2563eb' : (currentPhase === 'calibration' || currentPhase === 'ingestion' ? '#10B981' : '#E2E8F0'),
            color: '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {currentPhase === 'calibration' || currentPhase === 'ingestion' ? '✓' : '1'}
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: currentPhase === 'modality' ? 700 : 500, color: currentPhase === 'modality' ? '#0F172A' : '#64748B' }}>
            Modalidad de Entrada
          </span>
        </div>

        <div style={{ width: '40px', height: '2px', background: currentPhase !== 'modality' ? '#10B981' : '#E2E8F0' }} />

        {/* Step 2 Pill */}
        <div 
          onClick={() => !isBuilding && currentPhase === 'ingestion' && setCurrentPhase('calibration')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: !isBuilding && currentPhase === 'ingestion' ? 'pointer' : 'default',
            opacity: currentPhase === 'calibration' ? 1 : 0.7
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: currentPhase === 'calibration' ? '#2563eb' : (currentPhase === 'ingestion' ? '#10B981' : '#E2E8F0'),
            color: currentPhase === 'calibration' || currentPhase === 'ingestion' ? '#FFFFFF' : '#64748B',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {currentPhase === 'ingestion' ? '✓' : '2'}
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: currentPhase === 'calibration' ? 700 : 500, color: currentPhase === 'calibration' ? '#0F172A' : '#64748B' }}>
            Calibración Estratégica
          </span>
        </div>

        <div style={{ width: '40px', height: '2px', background: currentPhase === 'ingestion' ? '#10B981' : '#E2E8F0' }} />

        {/* Step 3 Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          opacity: currentPhase === 'ingestion' ? 1 : 0.7
        }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: currentPhase === 'ingestion' ? '#2563eb' : '#E2E8F0',
            color: currentPhase === 'ingestion' ? '#FFFFFF' : '#64748B',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            3
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: currentPhase === 'ingestion' ? 700 : 500, color: currentPhase === 'ingestion' ? '#0F172A' : '#64748B' }}>
            Ingestión de Documentos
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PHASE 1: MODALITY SELECTION (SOLO LAS 2 MODALIDADES)                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {currentPhase === 'modality' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '2rem'
        }}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              ¿Cómo deseas estructurar tu submission?
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#64748B', marginTop: '0.35rem' }}>
              Selecciona la fuente de información de tu despacho para activar la ruta de extracción guiada.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* CARD A: DRAFT */}
            <div 
              onClick={() => setModality('draft')}
              style={{
                cursor: 'pointer',
                padding: '1.75rem',
                borderRadius: '12px',
                border: modality === 'draft' ? '2px solid #2563eb' : '1px solid #E2E8F0',
                background: modality === 'draft' ? '#F8FAFC' : '#FFFFFF',
                boxShadow: modality === 'draft' ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {modality === 'draft' && (
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', color: '#2563eb' }}>
                  <CheckCircle2 size={22} />
                </div>
              )}
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: modality === 'draft' ? '#EFF6FF' : '#F1F5F9', color: modality === 'draft' ? '#2563eb' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <FileSpreadsheet size={24} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Modalidad A
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0.4rem 0 0.5rem 0' }}>
                Borrador de Directorio Existente
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Ideal si ya cuentas con el formulario Word oficial (.docx/.doc) de Chambers &amp; Partners, The Legal 500 o Leaders League. Extraeremos cada asunto y hecho fáctico de manera íntegra.
              </p>
            </div>

            {/* CARD B: MULTI-DOC / SCRATCH */}
            <div 
              onClick={() => setModality('scratch')}
              style={{
                cursor: 'pointer',
                padding: '1.75rem',
                borderRadius: '12px',
                border: modality === 'scratch' ? '2px solid #2563eb' : '1px solid #E2E8F0',
                background: modality === 'scratch' ? '#F8FAFC' : '#FFFFFF',
                boxShadow: modality === 'scratch' ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {modality === 'scratch' && (
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', color: '#2563eb' }}>
                  <CheckCircle2 size={22} />
                </div>
              )}
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: modality === 'scratch' ? '#EFF6FF' : '#F1F5F9', color: modality === 'scratch' ? '#2563eb' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Layers size={24} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Modalidad B
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0.4rem 0 0.5rem 0' }}>
                Documentos Dispersos o Desde Cero
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Ideal si tienes información desconectada (múltiples PDFs, Word, hilos de correo o notas sueltas). La IA agrupará los mandatos por cliente y los clasificará en casillas oficiales.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setCurrentPhase('calibration');
                setCalibrationSubStep(1);
              }}
              style={{
                background: '#2563eb',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.75rem 1.75rem',
                borderRadius: '8px',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Continuar a Calibración Estratégica</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PHASE 2: STRATEGIC CALIBRATION WIZARD (CAMPO POR CAMPO GUIADO)         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {currentPhase === 'calibration' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '2rem'
        }}>
          {/* Header of calibration wizard */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '1rem', marginBottom: '1.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                  Calibración Institucional
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>•</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                  Paso {calibrationSubStep} de {totalCalibrationSteps}
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '0.25rem 0 0 0' }}>
                {calibrationSubStep === 1 && '1. Target Directorio'}
                {calibrationSubStep === 2 && '2. País y Sede Principal'}
                {calibrationSubStep === 3 && '3. Región / Guía Editorial'}
                {calibrationSubStep === 4 && '4. Área de Práctica'}
                {calibrationSubStep === 5 && '5. Banda o Tier Actual de la Firma'}
                {calibrationSubStep === 6 && '6. Objetivo Estratégico Primario'}
                {calibrationSubStep === 7 && '7. Objetivo Estratégico Secundario'}
              </h2>
            </div>

            <button
              onClick={() => setCurrentPhase('modality')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Edit2 size={13} />
              <span>Modalidad: {modality === 'draft' ? 'Borrador' : 'Dispersos'}</span>
            </button>
          </div>

          {/* Substep Question Body */}
          <div style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* SUBSTEP 1 */}
            {calibrationSubStep === 1 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Para qué directorio legal estás estructurando este submission?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="Directorio Target"
                    value={targetDirectory}
                    onChange={setTargetDirectory}
                    options={DIRECTORIES}
                  />
                </div>
              </div>
            )}

            {/* SUBSTEP 2 */}
            {calibrationSubStep === 2 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Cuál es el país y jurisdicción principal donde opera este equipo legal?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="País de la Práctica"
                    value={country}
                    onChange={setCountry}
                    options={JURISDICTIONS}
                  />
                </div>
              </div>
            )}

            {/* SUBSTEP 3 */}
            {calibrationSubStep === 3 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Bajo qué guía regional o internacional se someterá la postulación?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="Región / Guía"
                    value={guideRegion}
                    onChange={setGuideRegion}
                    options={REGIONS}
                  />
                </div>
              </div>
            )}

            {/* SUBSTEP 4 */}
            {calibrationSubStep === 4 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Cuál es el área de práctica específica de los asuntos y abogados postulados?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="Área de Práctica"
                    value={practiceArea}
                    onChange={setPracticeArea}
                    options={PRACTICE_AREAS}
                  />
                </div>
              </div>
            )}

            {/* SUBSTEP 5 */}
            {calibrationSubStep === 5 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Cuál es la banda o tier actual del despacho en esta guía y práctica?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="Banda o Clasificación Actual"
                    value={currentBand}
                    onChange={setCurrentBand}
                    options={BANDS}
                  />
                </div>
              </div>
            )}

            {/* SUBSTEP 6 */}
            {calibrationSubStep === 6 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Cuál es el objetivo principal del submission ante los investigadores del directorio?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="Objetivo Primario"
                    value={primaryObjective}
                    onChange={setPrimaryObjective}
                    options={SUBMISSION_OBJECTIVES}
                  />
                </div>
              </div>
            )}

            {/* SUBSTEP 7 */}
            {calibrationSubStep === 7 && (
              <div>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.85rem' }}>
                  ¿Qué objetivo editorial secundario deseas potenciar?
                </p>
                <div style={{ maxWidth: '450px' }}>
                  <PremiumSelect
                    label="Objetivo Secundario"
                    value={secondaryObjective}
                    onChange={setSecondaryObjective}
                    options={SUBMISSION_OBJECTIVES}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stepper Footer Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
            <button
              onClick={() => {
                if (calibrationSubStep > 1) {
                  setCalibrationSubStep(prev => prev - 1);
                } else {
                  setCurrentPhase('modality');
                }
              }}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <ArrowLeft size={15} />
              <span>Anterior</span>
            </button>

            <button
              onClick={() => {
                if (calibrationSubStep < totalCalibrationSteps) {
                  setCalibrationSubStep(prev => prev + 1);
                } else {
                  setCurrentPhase('ingestion');
                }
              }}
              style={{
                background: '#2563eb',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              <span>{calibrationSubStep === totalCalibrationSteps ? 'Continuar a Ingestión de Documentos' : 'Siguiente'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PHASE 3: DOCUMENT INGESTION (SOLO APARECE TRAS CALIBRACIÓN)             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {currentPhase === 'ingestion' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          marginBottom: '2rem'
        }}>
          {/* Summary pill of calibrated data */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                Configuración:
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>
                {targetDirectory}
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                {country} ({guideRegion})
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>
                {practiceArea}
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                {currentBand}
              </span>
            </div>
            <button
              onClick={() => setCurrentPhase('calibration')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Edit2 size={13} />
              <span>Modificar</span>
            </button>
          </div>

          {/* If Modality A: Single Draft File */}
          {modality === 'draft' ? (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Borrador Oficial del Submission
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#64748B', marginTop: '0.2rem', marginBottom: 0 }}>
                  Sube el archivo Word oficial de tu firma (.docx / .doc) o pega el texto estructurado del borrador.
                </p>
              </div>

              {/* Tab switch for Draft (Upload vs Paste) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setDraftMode('upload')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: draftMode === 'upload' ? '#EFF6FF' : '#F8FAFC',
                    color: draftMode === 'upload' ? '#2563eb' : '#64748B'
                  }}
                >
                  Subir Documento Word (.docx / .doc)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode('paste')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: draftMode === 'paste' ? '#EFF6FF' : '#F8FAFC',
                    color: draftMode === 'paste' ? '#2563eb' : '#64748B'
                  }}
                >
                  Pegar Texto del Borrador
                </button>
              </div>

              {draftMode === 'upload' ? (
                <div
                  onClick={() => draftFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    background: selectedFile ? '#F0FDF4' : '#F8FAFC',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="file"
                    ref={draftFileInputRef}
                    onChange={handleDraftFileSelect}
                    accept=".docx,.doc"
                    style={{ display: 'none' }}
                  />
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: selectedFile ? '#DCFCE7' : '#EFF6FF', color: selectedFile ? '#16A34A' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                    {selectedFile ? <FileCheck size={24} /> : <Upload size={24} />}
                  </div>
                  {selectedFile ? (
                    <div>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#15803D', display: 'block' }}>
                        {selectedFile.name}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.2rem', display: 'block' }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Haz clic para cambiar de archivo
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0F172A', display: 'block' }}>
                        Selecciona o arrastra el borrador oficial en .docx o .doc
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.25rem', display: 'block' }}>
                        Compatible con plantillas de Chambers &amp; Partners, The Legal 500 y Leaders League
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    rows={9}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Pega aquí el contenido de las tablas o secciones oficiales de tu borrador..."
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      lineHeight: '1.5',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            /* If Modality B: Dispersed Documents Form */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Archivos de Respaldo y Documentos de Asuntos
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#64748B', marginTop: '0.2rem', marginBottom: 0 }}>
                    Puedes subir múltiples PDFs, documentos Word, notas de texto o correos electrónicos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => multiFileInputRef.current?.click()}
                  style={{
                    background: '#EFF6FF',
                    color: '#2563eb',
                    border: 'none',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Upload size={14} /> Añadir Archivos
                </button>
              </div>

              <input
                type="file"
                ref={multiFileInputRef}
                onChange={handleMultiFileSelect}
                multiple
                accept=".pdf,.docx,.doc,.txt,.eml"
                style={{ display: 'none' }}
              />

              {/* Uploaded Files List */}
              {sourceFiles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {sourceFiles.map((sf, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileCode size={16} color="#2563eb" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>{sf.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>({(sf.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSourceFile(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.2rem' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  onClick={() => multiFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                    background: '#F8FAFC',
                    cursor: 'pointer',
                    marginBottom: '1.25rem'
                  }}
                >
                  <Upload size={24} color="#94A3B8" style={{ margin: '0 auto 0.5rem auto' }} />
                  <span style={{ fontSize: '0.88rem', color: '#64748B', display: 'block' }}>
                    Haz clic aquí para seleccionar los archivos PDF, Word o notas sueltas.
                  </span>
                </div>
              )}

              {/* Additional Freeform Notes */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  Notas de Texto Adicionales o Hilos de Correo Pegados
                </label>
                <textarea
                  rows={4}
                  value={freeformNotes}
                  onChange={e => setFreeformNotes(e.target.value)}
                  placeholder="Pega aquí correos con instrucciones de socios, acuerdos comerciales o resúmenes breves..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    lineHeight: '1.5'
                  }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginTop: '1.25rem',
              color: '#B91C1C',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '1.5rem', marginTop: '1.75rem' }}>
            <button
              onClick={() => setCurrentPhase('calibration')}
              disabled={isBuilding}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: isBuilding ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <ArrowLeft size={15} />
              <span>Atrás a Calibración</span>
            </button>

            <button
              type="button"
              onClick={handleBuildSubmission}
              disabled={isBuilding}
              style={{
                background: isBuilding ? '#94A3B8' : '#2563eb',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: isBuilding ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: isBuilding ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {isBuilding ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{buildStepText || 'Construyendo submission...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Construir Submission con IA</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center', color: '#64748B' }}>
        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#2563eb' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cargando Builder...</span>
      </div>
    }>
      <BuilderContent />
    </Suspense>
  );
}
