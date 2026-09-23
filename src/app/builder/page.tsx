'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  FileCheck, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  FileSpreadsheet, 
  X, 
  Loader2, 
  ChevronRight, 
  Briefcase, 
  Globe, 
  Target,
  FileCode,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSubmission, getUserSubmissions } from '@/app/actions/submissions';
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

  // Mode Selection: 'draft' (Structured template) vs 'scratch' (Dispersed docs/notes)
  const initialMode = (searchParams.get('mode') === 'scratch' ? 'scratch' : 'draft') as IngestionModality;
  const [modality, setModality] = useState<IngestionModality>(initialMode);

  // Strategic Calibration State (7 Step Wizard)
  const [targetDirectory, setTargetDirectory] = useState('Chambers & Partners');
  const [country, setCountry] = useState('Mexico');
  const [guideRegion, setGuideRegion] = useState('Latin America');
  const [practiceArea, setPracticeArea] = useState('Tax');
  const [currentBand, setCurrentBand] = useState('Unranked');
  const [primaryObjective, setPrimaryObjective] = useState('First-time recognition');
  const [secondaryObjective, setSecondaryObjective] = useState('Highlight Cross-Border Mandates');
  const [deadline, setDeadline] = useState('');

  // Draft Modality States (Single file or pasted text)
  const [draftMode, setDraftMode] = useState<'upload' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const draftFileInputRef = useRef<HTMLInputElement>(null);

  // Scratch / Multi-Doc Modality States
  const [sourceFiles, setSourceFiles] = useState<UploadedSourceFile[]>([]);
  const [freeformNotes, setFreeformNotes] = useState('');
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Ingestion & Build State
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStepText, setBuildStepText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Recent Submissions
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  // Load existing submissions
  useEffect(() => {
    getUserSubmissions().then(res => {
      if (res.success && res.data) {
        setRecentSubmissions(res.data);
      }
    });
  }, []);

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

    // Validation
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
        deadline: deadline || undefined,
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
        setBuildStepText('Subiendo documento de borrador oficial a almacenamiento seguro...');
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
      // 4. Redirect to Submission Studio with validation wizard flag active
      router.push(`/reports/${submissionId}?validate=true`);

    } catch (err: any) {
      console.error('[BUILDER ERROR]:', err);
      setErrorMessage(err.message || 'Ocurrió un error inesperado al construir el submission.');
      setIsBuilding(false);
    }
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '2rem 1.5rem', color: '#0F172A' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', background: '#EEF2FF', borderRadius: '20px', color: '#4F46E5', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          <Sparkles size={14} /> Módulo Unificado de Creación
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', margin: 0 }}>
          Builder de Submissions
        </h1>
        <p style={{ fontSize: '0.95rem', color: '#64748B', marginTop: '0.4rem', maxWidth: '750px', lineHeight: 1.5 }}>
          Genera submissions jurídicos alineados al estándar editorial de Chambers &amp; Partners y The Legal 500. Elige tu modalidad de entrada y calibra tus objetivos estratégicos.
        </p>
      </div>

      {/* MODALITY SELECTION CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* CARD A: DRAFT */}
        <div 
          onClick={() => setModality('draft')}
          style={{
            cursor: 'pointer',
            padding: '1.5rem',
            borderRadius: '16px',
            border: modality === 'draft' ? '2px solid #4F46E5' : '1px solid #E2E8F0',
            background: modality === 'draft' ? 'linear-gradient(135deg, #FFFFFF 0%, #F5F7FF 100%)' : '#FFFFFF',
            boxShadow: modality === 'draft' ? '0 10px 25px -5px rgba(79, 70, 229, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          {modality === 'draft' && (
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#4F46E5' }}>
              <CheckCircle2 size={22} />
            </div>
          )}
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: modality === 'draft' ? '#EEF2FF' : '#F1F5F9', color: modality === 'draft' ? '#4F46E5' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <FileSpreadsheet size={22} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Modalidad A
          </span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0.35rem 0' }}>
            Borrador de Directorio Existente
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Sube el archivo Word oficial de tu firma (.docx / .doc) o pega el borrador estructurado. RankPilot extraerá cada asunto, abogado y hecho de manera íntegra y fáctica.
          </p>
        </div>

        {/* CARD B: MULTI-DOC / SCRATCH */}
        <div 
          onClick={() => setModality('scratch')}
          style={{
            cursor: 'pointer',
            padding: '1.5rem',
            borderRadius: '16px',
            border: modality === 'scratch' ? '2px solid #4F46E5' : '1px solid #E2E8F0',
            background: modality === 'scratch' ? 'linear-gradient(135deg, #FFFFFF 0%, #F5F7FF 100%)' : '#FFFFFF',
            boxShadow: modality === 'scratch' ? '0 10px 25px -5px rgba(79, 70, 229, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          {modality === 'scratch' && (
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#4F46E5' }}>
              <CheckCircle2 size={22} />
            </div>
          )}
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: modality === 'scratch' ? '#EEF2FF' : '#F1F5F9', color: modality === 'scratch' ? '#4F46E5' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Layers size={22} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Modalidad B
          </span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', margin: '0.35rem 0' }}>
            Documentos Dispersos o Desde Cero
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            Sube múltiples archivos (PDFs, Word, correos de socios, minutas o notas sueltas). La IA agrupará y clasificará cada mandato en su casilla correspondiente.
          </p>
        </div>
      </div>

      {/* STRATEGIC CALIBRATION WIZARD (7 QUESTIONS) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '1.75rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.85rem' }}>
          <Target size={20} color="#4F46E5" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Calibración Estratégica Institucional
          </h3>
          <span style={{ fontSize: '0.75rem', background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '6px', color: '#475569', fontWeight: 600 }}>
            7 Parámetros de Directorio
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {/* 1. Target Directory */}
          <div>
            <PremiumSelect
              label="1. Target Directorio"
              value={targetDirectory}
              onChange={setTargetDirectory}
              options={DIRECTORIES}
            />
          </div>

          {/* 2. Country */}
          <div>
            <PremiumSelect
              label="2. País / Sede de la Práctica"
              value={country}
              onChange={setCountry}
              options={JURISDICTIONS}
            />
          </div>

          {/* 3. Region */}
          <div>
            <PremiumSelect
              label="3. Región / Guía"
              value={guideRegion}
              onChange={setGuideRegion}
              options={REGIONS}
            />
          </div>

          {/* 4. Practice Area */}
          <div>
            <PremiumSelect
              label="4. Área de Práctica"
              value={practiceArea}
              onChange={setPracticeArea}
              options={PRACTICE_AREAS}
            />
          </div>

          {/* 5. Current Band */}
          <div>
            <PremiumSelect
              label="5. Banda o Tier Actual"
              value={currentBand}
              onChange={setCurrentBand}
              options={BANDS}
            />
          </div>

          {/* 6. Primary Objective */}
          <div>
            <PremiumSelect
              label="6. Objetivo Primario"
              value={primaryObjective}
              onChange={setPrimaryObjective}
              options={SUBMISSION_OBJECTIVES}
            />
          </div>

          {/* 7. Secondary Objective */}
          <div>
            <PremiumSelect
              label="7. Objetivo Secundario"
              value={secondaryObjective}
              onChange={setSecondaryObjective}
              options={SUBMISSION_OBJECTIVES}
            />
          </div>

          {/* Deadline */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
              Fecha Límite de Envío (Opcional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                color: '#0F172A',
                background: '#FFFFFF'
              }}
            />
          </div>
        </div>
      </div>

      {/* DROPZONE / CONTENT INGESTION SECTION */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '1.75rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
        marginBottom: '2rem'
      }}>
        {modality === 'draft' ? (
          <div>
            {/* Tab switch for Draft (Upload vs Paste) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setDraftMode('upload')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: draftMode === 'upload' ? '#EEF2FF' : '#F8FAFC',
                  color: draftMode === 'upload' ? '#4F46E5' : '#64748B'
                }}
              >
                Subir Documento DOCX / DOC
              </button>
              <button
                type="button"
                onClick={() => setDraftMode('paste')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: draftMode === 'paste' ? '#EEF2FF' : '#F8FAFC',
                  color: draftMode === 'paste' ? '#4F46E5' : '#64748B'
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
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: selectedFile ? '#DCFCE7' : '#EEF2FF', color: selectedFile ? '#16A34A' : '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
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
                      Compatible con plantillas de Chambers, The Legal 500 y Leaders League
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  Texto Íntegro del Borrador
                </label>
                <textarea
                  rows={10}
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Pega aquí el contenido de las tablas o secciones oficiales..."
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
          <div>
            {/* Multi-Doc Dropzone */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                  Archivos de Respaldo y Documentos de Asuntos
                </h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                  Puedes subir múltiples PDFs, documentos Word, notas de texto o correos electrónicos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => multiFileInputRef.current?.click()}
                style={{
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  border: 'none',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '8px',
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
                      <FileCode size={16} color="#6366F1" />
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
                  padding: '1.75rem',
                  textAlign: 'center',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                  marginBottom: '1.25rem'
                }}
              >
                <Upload size={22} color="#94A3B8" style={{ margin: '0 auto 0.5rem auto' }} />
                <span style={{ fontSize: '0.85rem', color: '#64748B', display: 'block' }}>
                  Haz clic aquí para seleccionar los archivos PDF, Word o notas sueltas.
                </span>
              </div>
            )}

            {/* Additional Freeform Notes */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                Notas de Texto Adicionales o Hilos de Correo Pegados
              </label>
              <textarea
                rows={5}
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

        {/* Error message banner */}
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

        {/* BUILD ACTION BUTTON */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleBuildSubmission}
            disabled={isBuilding}
            style={{
              background: isBuilding ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.85rem 1.75rem',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: isBuilding ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: isBuilding ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)',
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

      {/* RECENT SUBMISSIONS HISTORY */}
      {recentSubmissions.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Submissions Recientes en Proceso
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              {recentSubmissions.length} disponibles
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {recentSubmissions.slice(0, 6).map((sub: any) => {
              const fName = sub.chambersData?.firm_name || sub.chambersData?.firmName || 'Firma Legal';
              return (
                <div
                  key={sub.id}
                  onClick={() => router.push(`/reports/${sub.id}`)}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366F1')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase' }}>
                      {sub.targetDirectory}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#EEF2FF', color: '#3730A3', fontWeight: 600 }}>
                      {sub.status || 'Draft'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0.4rem 0 0.2rem 0' }}>
                    {fName} • {sub.practiceArea}
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Globe size={12} /> {sub.guideRegion}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <React.Suspense fallback={
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center', color: '#64748B' }}>
        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#4F46E5' }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cargando Builder...</span>
      </div>
    }>
      <BuilderContent />
    </React.Suspense>
  );
}

