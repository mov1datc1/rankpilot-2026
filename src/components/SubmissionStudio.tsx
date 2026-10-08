'use client';

import { processingFeedback } from '@/lib/ux/processing-feedback';
import { needsB10Optimization, hasValidatedSelection } from '@/lib/audit/optimization-state';
import { getDeliveryState } from '@/lib/audit/delivery-state';
import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { curateMatters } from '@/lib/docx/matter-curator';
import { 
  Download, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft, 
  FileText, 
  ShieldCheck, 
  Lock, 
  Building2, 
  Users, 
  Briefcase, 
  Award, 
  Sliders, 
  Info, 
  RefreshCw,
  Eye,
  Check,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Copy,
  Bookmark,
  ShieldAlert,
  X,
  BookOpen,
  Star,
  Save
} from 'lucide-react';
import { calculateEvidenceReadiness, EvidenceReadinessResult } from '@/lib/docx/evidence-readiness';
import ImportFromAssistantModal from '@/components/ImportFromAssistantModal';
import { needsInputReview, displayedMatterValue, hasPendingValue } from '@/lib/audit/input-review';
import { ReviewPanel, ReadableAudit } from '@/components/EditorialReview';
import { focusedReviewScope, reviewIsStale, type FocusedReviewScope, type ReviewDestination } from '@/lib/audit/review-actions';
import PostIngestionWizardModal from '@/components/PostIngestionWizardModal';
import { updateSubmissionValidatedData, updateDesignatedHeroMatter } from '@/app/actions/submissions';

interface MatterItem {
  id?: string;
  name?: string;
  title?: string;
  client?: string;
  value?: string;
  leadPartner?: string;
  lead_partner?: string;
  teamMembers?: string;
  crossBorder?: string;
  completionDate?: string;
  otherInfo?: string;
  isConfidential?: boolean;
  rawNotes?: string;
  optimizedText?: string;
  optimized_text?: string;
  status?: string;
}

interface SubmissionStudioProps {
  submission: {
    id: string;
    targetDirectory?: string;
    guideRegion?: string;
    practiceArea?: string;
    currentBand?: string;
    status?: string;
    matters: MatterItem[];
  };
  initialChambersData: any;
  auditChildren: React.ReactNode;
}

export default function SubmissionStudio({
  submission,
  initialChambersData,
  auditChildren
}: SubmissionStudioProps) {
  const router = useRouter();
  const [showValidationWizard, setShowValidationWizard] = useState<boolean>(false);
  const [reviewLawyersFirst, setReviewLawyersFirst] = useState(false);
  const [focusedReview, setFocusedReview] = useState<FocusedReviewScope | undefined>();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('validate') === 'true') {
        setShowValidationWizard(true);
      }
    }
  }, []);

  const [activeTab, setActiveTab] = useState<'studio' | 'audit'>('studio');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState<boolean>(false);
  const [showCoreOnly, setShowCoreOnly] = useState<boolean>(true);
  const [submissionStatus, setSubmissionStatus] = useState<string>(submission.status || 'Draft');
  const [showToolsMenu, setShowToolsMenu] = useState<boolean>(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown="tools"]') && !target.closest('[data-dropdown="download"]')) {
        setShowToolsMenu(false);
        setShowDownloadMenu(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);
  
  // Dynamic state for interactive studio edits
  const [chambersData, setChambersData] = useState<any>(initialChambersData || {});
  const [matters, setMatters] = useState<MatterItem[]>(() => {
    // Database fields plus revision-specific provenance/permissions from the JSON register.
    const dbMatters = submission.matters || [];
    const sourceMatters = dbMatters.length > 0 ? dbMatters : (chambersData.matters || []);
    const evidenceById = new Map((chambersData.matters || []).map((m: any) => [m.id, m]));
    return sourceMatters.map((m: any, idx: number) => ({
      ...(evidenceById.get(m.id) as any || {}),
      ...m,
      id: m.id || m._id || `matter-${idx}-${(m.client || m.name || m.title || 'item').toString().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    }));
  });

  // Directory Determination
  const selectedDirectory = (
    submission.targetDirectory || 
    chambersData.directory || 
    chambersData.targetDirectory || 
    initialChambersData?.strategicContext?.directory || 
    'Chambers'
  ).toString();
  const isLegal500 = selectedDirectory.toLowerCase().includes('500') || selectedDirectory.toLowerCase().includes('legal5');

  // B10 Narrative State
  const firmLowerSS = (chambersData.firm_name || chambersData.firmName || (submission as any).firmName || '').toLowerCase();
  const paLowerSS = (submission.practiceArea || chambersData.practice_area || '').toLowerCase();
  const initialB10 = chambersData.enhanced_b7
    || chambersData.enhanced_b10 
    || chambersData.b7 
    || chambersData.original_b10
    || chambersData.departmentDesc 
    || '';
  const [b10Text, setB10Text] = useState<string>(initialB10);
  const [b10Directive, setB10Directive] = useState<string>('');
  const [isOptimizingB10, setIsOptimizingB10] = useState<boolean>(false);
  const [b10SuccessMsg, setB10SuccessMsg] = useState<string>('');

  // Matter Micro-Optimization State
  const [optimizingMatterId, setOptimizingMatterId] = useState<string | null>(null);
  const [matterDirectives, setMatterDirectives] = useState<Record<string, string>>({});
  const [activeMatterDrawer, setActiveMatterDrawer] = useState<string | null>(null);
  const [matterSuccessMsg, setMatterSuccessMsg] = useState<Record<string, string>>({});

  // Global Optimization State
  const [isOptimizingAll, setIsOptimizingAll] = useState<boolean>(false);
  const [optimizeAllProgress, setOptimizeAllProgress] = useState<{
    current: number;
    total: number;
    stage: string;
  } | null>(null);
  const [optimizeAllComplete, setOptimizeAllComplete] = useState<boolean>(false);
  const [showReadinessModal, setShowReadinessModal] = useState<boolean>(false);
  const [partnerChecklistCopied, setPartnerChecklistCopied] = useState<boolean>(false);
  const [showAssistantModal, setShowAssistantModal] = useState<boolean>(false);
  const [allowDraftOptimization, setAllowDraftOptimization] = useState<boolean>(false);
  const [isSwitchingPractice, setIsSwitchingPractice] = useState<boolean>(false);
  const [editingMatterField, setEditingMatterField] = useState<{ matterId: string; field: string; value: string } | null>(null);

  // Evidence Readiness Engine (v27.0)
  const currentPracticeArea = chambersData.practice_area || submission.practiceArea || '';
  const readiness: EvidenceReadinessResult = React.useMemo(() => {
    return calculateEvidenceReadiness(matters, chambersData.lawyers || [], b10Text, {
      practiceArea: currentPracticeArea,
      calibratedPracticeArea: chambersData?.metadata?.calibrated_practice_area || ''
    });
  }, [matters, chambersData.lawyers, b10Text, currentPracticeArea, chambersData?.metadata?.calibrated_practice_area]);

  const jumpToMatter = (matterId: string) => {
    setShowReadinessModal(false);
    setTimeout(() => {
      const el = document.getElementById(`matter-card-${matterId}`) || document.getElementById('section-d');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '3px solid #4F46E5';
        el.style.boxShadow = '0 0 25px rgba(79, 70, 229, 0.45)';
        setTimeout(() => {
          el.style.outline = '';
          el.style.boxShadow = '';
        }, 3500);
      }
    }, 150);
  };

  const handleSwitchPracticeArea = async (newPractice: string) => {
    if (isSwitchingPractice) return;
    setIsSwitchingPractice(true);
    try {
      const result = await updateSubmissionValidatedData(submission.id, { practiceArea: newPractice });
      if (!result.success) throw new Error(result.error);
      setChambersData((prev: any) => ({
        ...prev,
        practice_area: newPractice,
        metadata: { ...(prev.metadata || {}), practice_area: newPractice, calibrated_practice_area: newPractice }
      }));
      window.location.reload();
    } catch (err) {
      console.error('Error switching practice area:', err);
      setIsSwitchingPractice(false);
    }
  };

  const handleUpdateMatterField = async (matterId: string, field: string, value: string) => {
    const updated = matters.map(m => {
      if (m.id === matterId) {
        return { ...m, [field]: value, optimizedText: '', optimized_text: '' };
      }
      return m;
    });
    setMatters(updated);
    setEditingMatterField(null);
    try {
      const result = await updateSubmissionValidatedData(submission.id, {expectedRevision: Number(chambersData.draft_revision || 0), matters: updated});
      if (!result.success) throw new Error(result.error);
      setMatters(result.matters || updated);
      setChambersData((prev: any) => ({...prev, draft_revision: result.revision, matters: result.matters || updated, release_verdict: {passed: false, status: 'needs_review'}}));
    } catch (err) {
      console.error('Error saving matter field:', err);
      setDraftSaveError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  };

  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [draftSavedToast, setDraftSavedToast] = useState<boolean>(false);
  const [draftSaveError, setDraftSaveError] = useState<string>('');

  const handleSaveDraft = async (): Promise<boolean> => {
    setIsSavingDraft(true);
    setDraftSaveError('');
    setDraftSavedToast(false);
    try {
      const result = await updateSubmissionValidatedData(submission.id, {
        expectedRevision: Number(chambersData.draft_revision || 0),
        matters, b10Text, practiceArea: currentPracticeArea,
        firmName: chambersData.firm_name || chambersData.firmName || ''
      });
      if (!result.success) throw new Error(result.error || 'No se pudo guardar el borrador.');
      if (result.matters) setMatters(result.matters);
      setChambersData((prev: any) => ({...prev, matters: result.matters || matters, draft_revision: result.revision, release_verdict: {passed: false, status: 'needs_review', errors: ['Borrador editado; requiere nueva revisión.']}}));
      setDraftSavedToast(true);
      setTimeout(() => setDraftSavedToast(false), 3500);
      return true;
    } catch (e) {
      setDraftSaveError(e instanceof Error ? e.message : 'No se pudo guardar. Tus cambios siguen en esta pantalla; reintenta antes de salir.');
      return false;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveDraftAndExit = async () => {
    if (await handleSaveDraft()) router.push('/reports');
  };

  const pendingInputMatters = matters.filter(needsInputReview);
  const [reviewPending, setReviewPending] = useState(false);

  const [activeReviewMessage,setActiveReviewMessage]=useState<string | undefined>();
  const [periodFrom, setPeriodFrom] = useState(initialChambersData?.research_period?.from || '');
  const [periodTo, setPeriodTo] = useState(initialChambersData?.research_period?.to || '');
  const saveResearchPeriod = async () => {
    setIsSavingDraft(true);setDraftSaveError('');
    try {
      const result=await updateSubmissionValidatedData(submission.id,{expectedRevision:Number(chambersData.draft_revision || 0),researchPeriod:{from:periodFrom,to:periodTo},reviewIssueMessage:activeReviewMessage});
      if(!result.success) throw new Error(result.error);
      setChambersData((prev:any)=>({...prev,research_period:{from:periodFrom,to:periodTo,source:'User-confirmed submission instructions'},draft_revision:result.revision,review_responses:result.reviewResponses,final_review_stale:true,approved_artifact:null,release_verdict:{passed:false,status:'needs_review'}}));
      setActiveReviewMessage(undefined);
      document.getElementById('studio-delivery-review')?.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error) {setDraftSaveError(error instanceof Error?error.message:'No se pudo guardar el periodo.');}
    finally {setIsSavingDraft(false);}
  };
  const [declaredRanking, setDeclaredRanking] = useState(submission.currentBand || '');
  const [rankingEdition, setRankingEdition] = useState(String(initialChambersData?.ranking_edition || 'current'));
  const [rankingCountry, setRankingCountry] = useState(initialChambersData?.ranking_jurisdiction || submission.guideRegion?.split('—').pop()?.trim() || '');
  const [checkingRanking, setCheckingRanking] = useState(false);
  const checkRanking = async () => {
    setCheckingRanking(true); setDraftSaveError('');
    try {
      const response = await fetch('/api/verify-ranking', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:submission.id,expectedRevision:Number(chambersData.draft_revision || 0),edition:rankingEdition,country:rankingCountry,declaredBand:declaredRanking})});
      const result = await response.json();
      if(!response.ok || !result.success) throw new Error(result.error || 'No se pudo verificar el ranking.');
      setChambersData(result.chambersData);
    } catch(error) {setDraftSaveError(error instanceof Error ? error.message : 'La consulta no está disponible.');}
    finally {setCheckingRanking(false);}
  };
  const deliveryState = getDeliveryState(chambersData, matters, true);
  const resolveReviewIssue = (destination: ReviewDestination, message: string) => {
    if (destination === 'retry-selection' || destination === 'retry-review') { void handleOptimizeAll(false,destination==='retry-review' && !reviewIsStale(chambersData)); return; }
    if (destination === 'wizard' || destination === 'lawyers') { setFocusedReview(focusedReviewScope(message,chambersData.lawyers || [],matters,(chambersData.final_artifact_review?.judge?.defects || []).find((d:any)=>d.message===message))); setReviewLawyersFirst(destination === 'lawyers'); setReviewPending(false); setShowValidationWizard(true); return; }
    setActiveReviewMessage(message);
    setActiveTab('studio');
    window.setTimeout(() => {
      const target=document.getElementById(destination === 'period' ? 'studio-research-period' : destination === 'ranking' ? 'studio-ranking-review' : 'studio-delivery-review');
      if (target instanceof HTMLDetailsElement) target.open=true;
      target?.scrollIntoView({behavior:'smooth',block:'start'});
    }, 100);
  };
  const reviewPanel = <ReviewPanel data={chambersData} errors={deliveryState.errors} warnings={deliveryState.warnings} approved={deliveryState.approved} onResolve={resolveReviewIssue} busy={isOptimizingAll} />;


  // Calculations
  const b10WordCount = b10Text.trim() ? b10Text.trim().split(/\s+/).length : 0;
  
  // Categorize matters into publishable (D), confidential (E), and pruned (surplus) using strategic curation
  const curation = React.useMemo(() => {
    return curateMatters(matters, currentPracticeArea || submission.practiceArea || '', chambersData);
  }, [matters, currentPracticeArea, submission.practiceArea, chambersData]);

  const coreCount = curation.officialPubMatters.length + curation.officialConfMatters.length;
  const surplusCount = curation.surplusPubMatters.length + curation.surplusConfMatters.length;

  const rawPubMatters = React.useMemo(() => matters.filter(m => !m.isConfidential), [matters]);
  const rawConfMatters = React.useMemo(() => matters.filter(m => m.isConfidential), [matters]);

  const hasRunOptimization = hasValidatedSelection(chambersData);
  const draftingPortfolio = hasRunOptimization ? [...curation.officialPubMatters,...curation.officialConfMatters] : matters;
  const optimizedMattersCount = draftingPortfolio.filter(m => (m.optimizedText || m.optimized_text || '').trim()).length;
  const targetMattersCount = draftingPortfolio.length;
  const isFullyOptimized = targetMattersCount > 0 && optimizedMattersCount >= targetMattersCount;

  const categorized = React.useMemo(() => {
    // Before AI optimization runs, do not prematurely prune or hide confidential/surplus matters.
    // Present all extracted matters verbatim tagged as 'Por calibrar con IA'.
    if (!hasRunOptimization) {
      return {
        pub: rawPubMatters,
        conf: rawConfMatters,
        pruned: [],
        total: matters.length,
      };
    }

    if (showCoreOnly) {
      return {
        pub: curation.officialPubMatters,
        conf: curation.officialConfMatters,
        pruned: [...curation.surplusPubMatters, ...curation.surplusConfMatters],
        total: matters.length,
      };
    } else {
      return {
        pub: [...curation.officialPubMatters, ...curation.surplusPubMatters],
        conf: [...curation.officialConfMatters, ...curation.surplusConfMatters],
        pruned: [],
        total: matters.length,
      };
    }
  }, [hasRunOptimization, rawPubMatters, rawConfMatters, curation, showCoreOnly, matters.length]);

  // Dynamic Case Intelligence for Editorial Copilot
  const firmName = chambersData.firm_name || chambersData.firmName || (submission as any).firmName || 'La Firma';
  const practiceAreaName = submission.practiceArea || chambersData.practice_area || 'Área de Práctica';

  // Helper to extract clean company/entity name from potentially verbose client strings
  const formatEntityName = (rawName: string): string => {
    if (!rawName) return 'Mandato Principal';
    // Remove newlines and trim
    let clean = rawName.split(/[\n\r]/)[0].trim();
    // If separated by dash or bullet or semicolon, take the corporate entity name
    if (clean.includes(' - ')) clean = clean.split(' - ')[0].trim();
    if (clean.includes(' — ')) clean = clean.split(' — ')[0].trim();
    if (clean.includes(' | ')) clean = clean.split(' | ')[0].trim();
    if (clean.length > 38) {
      return clean.substring(0, 35) + '...';
    }
    return clean;
  };

  // Helper to sanitize and format monetary values cleanly for copilot badges
  const formatCleanValue = (value:string):string => String(value || '').trim();

  const [userDesignatedHeroId, setUserDesignatedHeroId] = useState<string | null>(null);

  // Flagship Matter: strictly the hero matter (if designated) or top curated matter (1:1 with Hero Matter)
  const flagshipMatter = React.useMemo(() => {
    const all = [...(categorized.pub || []), ...(categorized.conf || []), ...(categorized.pruned || []), ...(matters || [])];
    
    const canonicalId=chambersData.canonical_matter_selection?.hero_matter_id || chambersData.hero_matter_id;
    if(canonicalId) return all.find(m=>m.id===canonicalId) || null;
    // 1. Explicit Hero Matter ID designated by user via "⭐ Hacer Insignia" button in current session
    if (userDesignatedHeroId) {
      const found = all.find(m => String(m.id || (m as any).matter_id || '').toLowerCase() === String(userDesignatedHeroId).toLowerCase());
      if (found) return found;
    }

    // 2. Explicit Hero Matter ID intentionally saved by user previously
    const userSelectedHeroId = chambersData?.user_selected_hero_id;
    if (userSelectedHeroId) {
      const found = all.find(m => String(m.id || (m as any).matter_id || '').toLowerCase() === String(userSelectedHeroId).toLowerCase());
      if (found) return found;
    }

    return null;
  }, [categorized, matters, chambersData, userDesignatedHeroId]);

  const verifiedValuesList = React.useMemo(() => {
    const list = [...(categorized.pub || []), ...(categorized.conf || [])];
    if (list.length === 0) return [];
    return list
      .filter(m => !hasPendingValue(m) && m.value && m.value.trim().length > 0 && m.value !== 'N/A' && m.value !== 'Not disclosed')
      .slice(0, 3)
      .map(m => ({
        name: formatEntityName(m.client || m.name || m.title || 'Asunto'),
        value: formatCleanValue(m.value) || m.value
      }));
  }, [categorized]);

  // Department & Leadership Data for Section B Desglose (B1 - B9)
  const departmentName = chambersData.departmentName 
    || chambersData.department?.department_name 
    || chambersData.department?.name 
    || submission.practiceArea 
    || 'Departamento Legal';

  const numPartners = chambersData.numPartners 
    ?? chambersData.department?.num_partners 
    ?? chambersData.department?.numPartners 
    ?? null;

  const numLawyers = chambersData.numLawyers 
    ?? chambersData.department?.num_lawyers 
    ?? chambersData.department?.numLawyers 
    ?? null;

  const primaryLeadPartner = matters.find(m => m.leadPartner || m.lead_partner)?.leadPartner 
    || matters.find(m => m.leadPartner || m.lead_partner)?.lead_partner 
    || '';

  const departmentHeads: any[] = React.useMemo(() => {
    if (chambersData.departmentHeads && chambersData.departmentHeads.length > 0) {
      return chambersData.departmentHeads;
    }
    if (chambersData.department?.department_heads && chambersData.department?.department_heads.length > 0) {
      return chambersData.department?.department_heads;
    }
    return [];
  }, [chambersData, primaryLeadPartner, firmName]);

  const hiresList: any[] = chambersData.hires || chambersData.department?.hires_departures || [];
  const lawyersList: any[] = chambersData.lawyers || [];

  const c2Text = chambersData.enhanced_c2
    || chambersData.analysis?.audit_letter?.competitive_positioning_text
    || chambersData.analysis?.competitive_positioning_text
    || chambersData.competitive_positioning_text
    || chambersData.feedback
    || chambersData.c2
    || '';

  const pubClients = React.useMemo(() => {
    return [...new Set(categorized.pub.map(m => m.client).filter(Boolean))] as string[];
  }, [categorized.pub]);

  // Evidence Readiness Micro-Badges Helper
  const getMatterBadges = (m: MatterItem) => {
    const badges: { label: string; color: string; bg: string; icon?: string }[] = [];
    const text = m.optimizedText || m.optimized_text || m.rawNotes || '';
    const hasClient = Boolean(m.client && m.client.trim() !== '' && (m.isConfidential || m.client.toLowerCase() !== 'confidencial'));
    const pendingValue = hasPendingValue(m);
    const hasValue = !pendingValue && Boolean(m.value && m.value.trim() !== '' && !m.value.toLowerCase().includes('n/a'));
    const hasLead = Boolean((m.leadPartner || m.lead_partner || '').trim() !== '');
    const hasSubstance = text.length >= 120;

    if (!hasClient) {
      badges.push({ label: 'Falta Cliente', color: '#DC2626', bg: '#FEE2E2', icon: '✕' });
    }
    if (pendingValue) {
      badges.push({ label: 'Monto por definir', color: '#D97706', bg: '#FEF3C7', icon: '⚠' });
    } else if (!hasValue) {
      badges.push({ label: 'Sin Monto', color: '#D97706', bg: '#FEF3C7', icon: '⚠' });
    }
    if (!hasLead) {
      badges.push({ label: 'Sin Socio', color: '#4338CA', bg: '#EEF2FF', icon: '○' });
    }
    if (!hasSubstance) {
      badges.push({ label: 'Descripción por revisar', color: '#DC2626', bg: '#FEE2E2', icon: '⚠' });
    }
    if (hasClient && hasValue && hasLead && hasSubstance) {
      badges.push({ label: 'Datos básicos presentes', color: '#16A34A', bg: '#DCFCE7', icon: '✓' });
    }
    return badges;
  };

  // Generate and Copy Partner Inquiry Questionnaire to Clipboard
  const handleCopyPartnerQuestionnaire = () => {
    let text = `SOLICITUD DE INFORMACIÓN PARA SUBMISSION CHAMBERS / LEGAL 500\n`;
    text += `Firma: ${firmName} | Práctica: ${practiceAreaName}\n`;
    text += `Campos básicos presentes: ${readiness.score}% (${readiness.label})\n`;
    text += `Fecha: ${new Date().toLocaleDateString('es-MX')}\n\n`;
    text += `Estimados Socios y Asociados:\n`;
    text += `Para completar la postulación oficial de la práctica ante el directorio y asegurar la mejor evaluación editorial, necesitamos solventar los siguientes datos faltantes antes de optimizar:\n\n`;

    const incompleteMatters = readiness.matterStatuses.filter(s => !s.isComplete);
    if (incompleteMatters.length > 0) {
      text += `ASUNTOS CON INFORMACIÓN PENDIENTE (${incompleteMatters.length}):\n`;
      incompleteMatters.forEach((item, i) => {
        text += `\n${i + 1}. Asunto: "${item.name}"\n`;
        text += `   Datos faltantes: ${item.missingFields.join(', ')}\n`;
        text += `   Preguntas a responder:\n`;
        if (!item.hasClient) text += `   - ¿Quién es el cliente corporativo o qué descripción sectorial podemos usar si es confidencial?\n`;
        if (!item.hasValue) text += `   - Si aplica un valor económico, ¿qué importe, moneda y tipo de valor acredita la fuente?\n`;
        if (!item.hasOutcome) text += `   - ¿Cuál es el estado actual y su fecha? Si hay un resultado o hito, ¿qué fuente lo acredita?\n`;
        if (!item.hasLeadPartner) text += `   - ¿Quién es el socio líder y asociados clave asignados a este asunto?\n`;
      });
    } else {
      text += `Los campos básicos revisados están presentes; queda pendiente la revisión editorial y del archivo.\n`;
    }

    text += `\nFavor de enviar estos datos a la brevedad para incorporar al borrador de RankPilot.\n`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setPartnerChecklistCopied(true);
      setTimeout(() => setPartnerChecklistCopied(false), 4000);
    }
  };

  // Studio starts a durable job and observes it; the worker owns all transitions.
  const [jobWatch, setJobWatch] = useState(0);
  useEffect(() => {
    let stopped=false;
    let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    const observe=async()=>{
      try {
        const response=await fetch(`/api/editorial/jobs?submissionId=${encodeURIComponent(submission.id)}`,{cache:'no-store',signal:controller.signal});
        if(!response.ok) throw new Error('No se pudo consultar el avance. El motor continúa independientemente de esta pestaña.');
        const data=await response.json();
        if(stopped || !data.job) return;
        const active=['queued','running'].includes(data.job.status);
        setIsOptimizingAll(active);
        setOptimizeAllProgress({current:data.job.completed,total:data.job.total,stage:active?`${data.job.message}. Puedes cerrar esta pestaña; el avance se guarda.`:data.job.status==='completed'?'Submission y Audit revisados. Puedes descargar la entrega.':'Revisión detenida. Consulta el pendiente concreto.'});
        if(active) {timer=setTimeout(observe,3000);return;}
        setOptimizeAllComplete(data.job.status==='completed');
        if(data.job.issue) setDraftSaveError(`${data.job.issue.owner==='rankpilot'?'RankPilot: ':''}${data.job.issue.message}`);
        if(data.chambersData) {
          setChambersData(data.chambersData);
          if(data.matters) setMatters(data.matters);
          setB10Text(data.chambersData.enhanced_b7 || data.chambersData.original_b10 || '');
          setSubmissionStatus(data.status || 'Draft');
        }
      } catch(error) {
        if(stopped) return;
        if(jobWatch) setDraftSaveError(error instanceof Error?error.message:'No se pudo consultar el avance.');
        timer=setTimeout(observe,10000);
      }
    };
    void observe();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[submission.id,jobWatch]);

  const handleOptimizeAll = async (_bypassReadiness:boolean=false,repairGenerated=false) => {
    if(pendingInputMatters.length) {setReviewPending(true);setShowValidationWizard(true);return;}
    if(isOptimizingAll) return;
    if(!readiness.canOptimize) {setShowReadinessModal(true);return;}
    setShowReadinessModal(false);
    const savedMatters=chambersData.matters || submission.matters || [];
    const dirty=b10Text!==(chambersData.enhanced_b7 || chambersData.original_b10 || '') || JSON.stringify(matters)!==JSON.stringify(savedMatters);
    if(dirty && !(await handleSaveDraft())) return;
    setDraftSaveError('');
    setIsOptimizingAll(true);
    setOptimizeAllComplete(false);
    try {
      const response=await fetch('/api/editorial/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:submission.id,retry:true,repair:repairGenerated})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'No se pudo iniciar la revisión.');
      setOptimizeAllProgress({current:data.job.completed,total:data.job.total,stage:data.job.message});
      setJobWatch(value=>value+1);
    } catch(error) {
      setIsOptimizingAll(false);
      setDraftSaveError(error instanceof Error?error.message:'No se pudo iniciar la revisión.');
    }
  };

  // Handler: Re-optimize B10 (3s isolated micro-call)
  const handleOptimizeB10 = async () => {
    setIsOptimizingB10(true);
    setB10SuccessMsg('');
    setDraftSaveError('');
    try {
      const res = await fetch('/api/optimize/b10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          original_b10: b10Text || chambersData.original_b10 || '',
          directive: b10Directive
        })
      });

      const data = await res.json();
      if (data.revision !== undefined) setChambersData((prev: any) => ({...prev, draft_revision: Math.max(Number(prev.draft_revision || 0), data.revision), approved_artifact: null, release_verdict: {passed:false,status:'needs_review'}}));
      if (data.success && data.enhanced_b10) {
        setB10Text(data.enhanced_b10);
        setChambersData((prev:any)=>({...prev,enhanced_b7:data.enhanced_b10,b10_optimization:data.b10_optimization}));
        setB10SuccessMsg('Redacción del departamento guardada. La aprobación final sigue pendiente.');
        setTimeout(() => setB10SuccessMsg(''), 4000);
      } else {
        setDraftSaveError(processingFeedback(data,res.status,'optimize'));
      }
    } catch (err: any) {
      setDraftSaveError(processingFeedback({},0,'optimize'));
    } finally {
      setIsOptimizingB10(false);
    }
  };

  // Handler: Re-optimize single matter (3s isolated micro-call)
  const handleOptimizeMatter = async (matter: MatterItem, matterIdx: number) => {
    if (needsInputReview(matter)) { setReviewPending(true); setShowValidationWizard(true); return; }
    const key = matter.id || `matter-${matterIdx}`;
    setDraftSaveError('');
    setOptimizingMatterId(key);
    setMatterSuccessMsg(prev => ({ ...prev, [key]: '' }));

    try {
      const directive = matterDirectives[key] || '';
      const res = await fetch('/api/optimize/matter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          matterId: matter.id,
          matter: matter,
          directive: directive
        })
      });

      const data = await res.json();
      if (data.revision !== undefined) setChambersData((prev: any) => ({...prev, draft_revision: Math.max(Number(prev.draft_revision || 0), data.revision), approved_artifact: null, release_verdict: {passed:false,status:'needs_review'}}));
      if (data.success && data.optimized_text) {
        // Update matters state
        setMatters(prev => prev.map((m, idx) => {
          if (m.id && m.id === matter.id) {
            return {
              ...m,
              optimizedText: data.optimized_text,
              optimized_text: data.optimized_text
            };
          }
          return m;
        }));

        setMatterSuccessMsg(prev => ({
          ...prev,
          [key]: 'Nueva redacción guardada; pendiente de revisión final.'
        }));
        setTimeout(() => {
          setMatterSuccessMsg(prev => ({ ...prev, [key]: '' }));
        }, 4000);
      } else {
        setDraftSaveError(processingFeedback(data,res.status,'optimize'));
      }
    } catch (err: any) {
      setDraftSaveError(processingFeedback({},0,'optimize'));
    } finally {
      setOptimizingMatterId(null);
    }
  };

  // Designate an Insignia / Flagship Matter manually
  const handleSetHeroMatter = async (matter: MatterItem) => {
    const heroId = matter.id || '';
    const heroTitle = matter.client || matter.name || matter.title || 'Asunto Insignia';
    
    setUserDesignatedHeroId(heroId);

    // Update local matters state with isHero
    setMatters(prev => prev.map(m => ({
      ...m,
      isHero: m.id === heroId
    })));

    // Update chambersData in state
    const updatedChambersData = {
      ...chambersData,
      approved_artifact: null,
      release_verdict: {passed:false,status:'needs_review'},
      user_selected_hero_id: heroId,
      hero_matter_id: heroId,
      hero_matter_title: heroTitle,
      hero_matter_name: heroTitle,
      narrative_architecture: {
        ...(chambersData.narrative_architecture || {}),
        hero_matter: heroTitle
      },
      canonical_matter_selection: {
        ...(chambersData.canonical_matter_selection || {}),
        hero_matter_id: heroId,
        hero_matter_title: heroTitle
      }
    };
    setChambersData(updatedChambersData);

    // Persist via Server Action
    try {
      const result = await updateDesignatedHeroMatter(submission.id, heroId, heroTitle);
      if (!result.success) throw new Error(result.error);
      setChambersData((prev:any)=>({...prev,draft_revision:result.revision}));
    } catch (err) {
      console.error('Failed to persist designated hero matter:', err);
      setDraftSaveError(err instanceof Error ? err.message : 'No se pudo guardar la selección.');
    }
  };

  // Scroll to anchor helper
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="rankpilot-studio" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F8FAFC' }}>
      <style>{`
        .rankpilot-studio, .rankpilot-studio * { box-sizing: border-box; }
        .rankpilot-studio { max-width: 100%; overflow-wrap: anywhere; }
        .rankpilot-studio, .rankpilot-studio * { box-sizing: border-box; }
        .studio-canvas { min-width: 0; }
        .rankpilot-studio { container-type: inline-size; }
        .studio-toolbar { flex-wrap: wrap; gap: 12px; }
        .studio-toolbar > div { flex-wrap: wrap; gap: 12px !important; max-width: 100%; min-width: 0; }
        .studio-toolbar button { flex-shrink: 0; overflow-wrap: normal; word-break: normal; white-space: nowrap; }
        .studio-toolbar svg { flex-shrink: 0; }
        @container (max-width: 1100px) {
          .studio-columns { flex-wrap: wrap; }
          .studio-copilot { width: 100% !important; position: relative !important; top: 0 !important; height: auto !important; }
          .studio-canvas { max-width: none !important; }
        }
        @container (max-width: 700px) {
          .studio-tabs { max-width: 100%; min-width: 0; }
          .studio-tabs button { min-width: 0; padding: 8px !important; white-space: normal; }
          .studio-columns { flex-direction: column; }
          .studio-nav { width: 100% !important; height: auto !important; max-height: 180px; position: relative !important; top: 0 !important; }
          .studio-canvas { width: 100%; padding: 16px !important; }
        }
        @media (max-width: 900px) {
          .studio-toolbar { position: relative !important; padding: 12px !important; flex-wrap: wrap; gap: 12px; }
          .studio-toolbar > div { flex-wrap: wrap; max-width: 100%; gap: 8px !important; }
          .studio-tabs { max-width: 100%; min-width: 0; }
          .studio-tabs button { min-width: 0; padding: 8px !important; white-space: normal; }
          .studio-columns { flex-direction: column; }
          .studio-nav, .studio-copilot { width: 100% !important; height: auto !important; max-width: 100% !important; flex-basis: auto !important; position: relative !important; top: 0 !important; }
          .studio-nav { max-height: 180px; }
          .studio-canvas { width: 100%; max-width: 100% !important; padding: 16px !important; }
          .rankpilot-studio [style*='grid-template-columns'] { grid-template-columns: minmax(0, 1fr) !important; }
          .studio-canvas [style*='min-width: 280px'] { min-width: 0 !important; flex: 1 1 100% !important; }
          .studio-canvas [style*='display: flex'] { flex-wrap: wrap; }
          .rankpilot-studio input, .rankpilot-studio textarea { max-width: 100%; min-width: 0; }
        }
      `}</style>
      
      {/* ═══ TOP BAR & TABS ═══ */}
      <div className="studio-toolbar" style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Brand Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #1A237E 0%, #3949AB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <Sparkles size={16} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              Submission Studio
              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 500, color: '#64748B', maxWidth: '240px' }}>
                {firmName} · {submission.practiceArea}
              </span>
            </span>
          </div>

          <div style={{ width: '1px', height: '24px', background: '#E2E8F0' }} />

          {/* Mode Switcher Tabs */}
          <div className="studio-tabs" style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => setActiveTab('studio')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'studio' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'studio' ? '#1A237E' : '#64748B',
                fontWeight: activeTab === 'studio' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'studio' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={14} color={activeTab === 'studio' ? '#4F46E5' : '#64748B'} />
              <span>Formulario Submission</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'audit' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'audit' ? '#1A237E' : '#64748B',
                fontWeight: activeTab === 'audit' ? 600 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'audit' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Award size={14} color={activeTab === 'audit' ? '#1A237E' : '#64748B'} />
              <span>Strategic Audit Report</span>
            </button>
          </div>
        </div>

        {/* Master DOCX Downloads & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Evidence Quality Interactive Badge */}
          <button
            type="button"
            onClick={() => setShowReadinessModal(true)}
            style={{
              background: readiness.level === 'critical' ? '#FEF2F2' : readiness.bgColor,
              border: readiness.level === 'critical' ? '1.5px solid #FECACA' : `1px solid ${readiness.color}40`,
              color: readiness.level === 'critical' ? '#DC2626' : readiness.color,
              padding: '0.45rem 0.75rem',
              borderRadius: '7px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Consulta los campos presentes y los datos pendientes. Este indicador no certifica calidad ni ranking."
            onMouseEnter={e => {
              const c = readiness.level === 'critical' ? '#DC2626' : readiness.color;
              e.currentTarget.style.borderColor = c;
              e.currentTarget.style.boxShadow = `0 1px 4px ${c}25`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = readiness.level === 'critical' ? '#FECACA' : `${readiness.color}40`;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: readiness.level === 'critical' ? '#DC2626' : readiness.color }} />
            <span>{readiness.score}% datos · {deliveryState.approved ? 'aprobado' : 'sin aprobar'}</span>
            <HelpCircle size={13} style={{ opacity: 0.75, marginLeft: '1px' }} />
          </button>

          {/* Quick Save Draft Action */}
          <button
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
            style={{
              background: draftSavedToast ? '#DCFCE7' : '#FFFFFF',
              border: `1px solid ${draftSavedToast ? '#86EFAC' : '#CBD5E1'}`,
              color: draftSavedToast ? '#166534' : '#475569',
              padding: '0.45rem 0.8rem',
              borderRadius: '7px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: isSavingDraft ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Guardar borrador actual. Recuerda que los cambios también se respaldan automáticamente."
          >
            {isSavingDraft ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : draftSavedToast ? (
              <Check size={13} color="#16A34A" />
            ) : (
              <Save size={13} color="#64748B" />
            )}
            <span>{isSavingDraft ? 'Guardando...' : draftSavedToast ? '✓ Borrador Guardado' : 'Guardar Borrador'}</span>
          </button>

          {/* Grouped Tools Dropdown */}
          <div style={{ position: 'relative' }} data-dropdown="tools">
            <button
              onClick={() => {
                setShowToolsMenu(prev => !prev);
                setShowDownloadMenu(false);
              }}
              style={{
                background: showToolsMenu ? '#F1F5F9' : '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#334155',
                padding: '0.45rem 0.8rem',
                borderRadius: '7px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Herramientas y opciones de preparación del submission"
            >
              <Sliders size={14} color="#4F46E5" />
              <span>Herramientas</span>
              <ChevronDown size={14} style={{ transform: showToolsMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {showToolsMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                zIndex: 100,
                width: '265px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                padding: '0.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setReviewPending(false);
                    setShowValidationWizard(true);
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <CheckCircle2 size={16} color="#4F46E5" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>Validar Datos Extraídos</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Revisión guiada paso a paso</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAssistantModal(true);
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <BookOpen size={16} color="#4F46E5" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>Importar Asuntos</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Cargar desde Matter Assistant</div>
                  </div>
                </button>

                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

                <a
                  href={`/api/generate-docx?id=${submission.id}&type=submission&mode=original`}
                  onClick={() => setShowToolsMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={16} color="#64748B" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>Ver Borrador Original</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>DOCX con textos originales sin optimizar</div>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Primary CTA: Optimizar Todo */}
          <button
            onClick={() => handleOptimizeAll(false)}
            disabled={isOptimizingAll}
            style={{
              background: isOptimizingAll 
                ? '#CBD5E1' 
                : isFullyOptimized 
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
                  : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.5rem 1.15rem',
              borderRadius: '7px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: isOptimizingAll ? 'not-allowed' : 'pointer',
              boxShadow: isOptimizingAll 
                ? 'none' 
                : isFullyOptimized 
                  ? '0 2px 6px rgba(5,150,105,0.25)' 
                  : '0 2px 6px rgba(79,70,229,0.3)',
              transition: 'all 0.15s ease'
            }}
            title={isFullyOptimized ? 'Los asuntos ya están optimizados. Revisa y genera los entregables; los pendientes se procesan al continuar.' : 'Ejecutar optimización editorial integral bajo estándares Chambers'}
          >
            <Sparkles size={14} className={isOptimizingAll ? 'animate-spin' : ''} />
            <span>{isOptimizingAll ? 'Preparando entrega…' : 'Preparar Submission y Audit'}</span>
          </button>

          {/* Unified Download Dropdown */}
          {draftSaveError && <div role="alert" style={{position:'fixed',bottom:16,right:16,zIndex:100,color:'#991B1B',background:'#FFF7ED',border:'1px solid #FDBA74',borderRadius:10,padding:16,width:'calc(100vw - 32px)',maxWidth:440,maxHeight:'30vh',overflowY:'auto',fontSize:14,boxShadow:'0 4px 20px #0002'}}>{draftSaveError.length <= 220 ? draftSaveError : <><strong>No se pudo completar esta acción.</strong><details style={{marginTop:8}}><summary>Ver motivo completo</summary><p style={{whiteSpace:'pre-wrap'}}>{draftSaveError}</p></details></>}<button type="button" aria-label="Ocultar aviso" onClick={()=>setDraftSaveError('')} style={{display:'block',marginTop:8}}>Entendido</button></div>}
          <div style={{ position: 'relative' }} data-dropdown="download">
            <button
              onClick={() => {
                setShowDownloadMenu(prev => !prev);
                setShowToolsMenu(false);
              }}
              style={{
                background: '#1A237E',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '7px',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(26,35,126,0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={14} />
              <span>Descargar</span>
              <ChevronDown size={14} style={{ transform: showDownloadMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {showDownloadMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                zIndex: 100,
                width: '280px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                padding: '0.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                {/* Official Master DOCX */}
                <a
                  href={isLegal500
                    ? `/api/generate-docx?id=${submission.id}&type=submission&template=master_legal500&mode=optimized`
                    : `/api/generate-docx?id=${submission.id}&type=submission&template=master_chambers&mode=optimized`}
                  aria-disabled={!deliveryState.approved}
                  title={deliveryState.approved ? 'Descargar Submission aprobado' : 'Consulta los pendientes de entrega'}
                  onClick={(e) => { if (!deliveryState.approved) { e.preventDefault(); setShowDownloadMenu(false); setActiveTab('studio'); window.setTimeout(()=>document.getElementById('studio-delivery-review')?.scrollIntoView({behavior:'smooth',block:'start'}),100); } else setShowDownloadMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    background: '#F8FAFC',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EEF2FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}
                >
                  <Download size={16} color="#1A237E" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A237E' }}>
                      {isLegal500 ? 'Legal 500 Master DOCX' : 'Chambers Master DOCX'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      {deliveryState.approved ? 'Disponible tras revisión' : 'Pendiente: revisa los bloqueos antes de descargar'}
                    </div>
                  </div>
                </a>

                {/* Audit Estratégico DOCX */}
                <a
                  href={`/api/generate-docx?id=${submission.id}&type=audit`}
                  onClick={() => setShowDownloadMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={16} color="#4F46E5" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>
                      Audit Estratégico DOCX
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Carta ejecutiva para socios con conciliación 1:1
                    </div>
                  </div>
                </a>

                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

                {/* Borrador Original */}
                <a
                  href={`/api/generate-docx?id=${submission.id}&type=submission&mode=original`}
                  onClick={() => setShowDownloadMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={16} color="#64748B" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                      Borrador Original DOCX
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Documento con textos literales sin optimizar
                    </div>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ GLOBAL OPTIMIZATION PROGRESS BANNER ═══ */}
      {optimizeAllProgress && (
        <div style={{
          position: 'sticky',
          top: '57px',
          zIndex: 25,
          background: 'linear-gradient(90deg, #1E1B4B 0%, #312E81 100%)',
          color: '#FFFFFF',
          padding: '0.85rem 2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          borderBottom: '1px solid #4338CA'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <RefreshCw size={18} className="animate-spin" style={{ color: '#38BDF8' }} />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF', marginRight: '0.5rem' }}>
                  Preparación de Submission y Audit:
                </span>
                <span role="status" aria-live="polite" style={{ fontSize: '0.85rem', color: '#E0E7FF' }}>
                  {optimizeAllProgress.stage}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '4px', color: '#BAE6FD', fontWeight: 600 }}>
                {optimizeAllProgress.current} de {optimizeAllProgress.total} pasos procesados
              </span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#38BDF8' }}>
                {Math.min(100, Math.round((optimizeAllProgress.current / Math.max(1, optimizeAllProgress.total)) * 100))}%
              </span>
            </div>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, Math.round((optimizeAllProgress.current / Math.max(1, optimizeAllProgress.total)) * 100))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38BDF8 0%, #818CF8 100%)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* ═══ AUDIT TAB VIEW ═══ */}
      {activeTab === 'audit' && (
        <div style={{ maxWidth: '64rem', margin: '2rem auto', width: '100%', padding: '0 2rem' }}>
          {(!chambersData.editorial_review?.letter && !chambersData.analysis?.score && !chambersData.analysis?.audit_letter?.the_state_of_play) && (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} color="#2563EB" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1E3A8A' }}>
                    Strategic Audit Report Pendiente
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#1E40AF' }}>
                    Ejecuta la revisión para generar el Audit con la selección de asuntos, atribución de abogados y acciones pendientes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleOptimizeAll(false)}
                disabled={isOptimizingAll}
                style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                }}
              >
                ✨ Optimizar Todo y Generar Audit
              </button>
            </div>
          )}
          {chambersData.editorial_review?.letter ? <div style={{display:'grid',gap:20}}><details style={{background:'#EFF6FF',border:'1px solid #C7D2FE',borderRadius:12,padding:16}}><summary style={{cursor:'pointer',fontWeight:700,color:'#3730A3'}}>{deliveryState.approved ? 'Entrega aprobada' : 'Ver pendientes para obtener el Submission'} →</summary><div style={{marginTop:16}}>{reviewPanel}</div></details><ReadableAudit letter={chambersData.editorial_review.letter} label={deliveryState.label} /></div> : chambersData.editorial_review ? <article><h2>Audit pendiente de generación</h2><p>La revisión se interrumpió antes de redactar el Audit. Las redacciones guardadas se conservan; reintenta Optimizar Todo para continuar.</p><ul>{deliveryState.errors.map((message:string)=><li key={message}>{message}</li>)}</ul></article> : <><p role="note">Informe previo: requiere una nueva revisión antes de considerarse aprobado para entrega.</p>{auditChildren}</>}

        </div>
      )}

      {/* ═══ STUDIO TAB VIEW (3 COLUMNS) ═══ */}
      {activeTab === 'studio' && (
        <div className="studio-columns" style={{ display: 'flex', flex: 1, position: 'relative' }}>
          
          {/* ── LEFT SIDEBAR (NAV) ── */}
          <div className="studio-nav" style={{
            width: sidebarCollapsed ? '60px' : '250px',
            transition: 'width 0.2s ease',
            background: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
            position: 'sticky',
            top: '57px',
            height: 'calc(100vh - 57px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            {/* Sidebar Toggle */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between'
            }}>
              {!sidebarCollapsed && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Estructura Formulario
                </span>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                  borderRadius: '4px'
                }}
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            {/* Nav Items */}
            <div style={{ padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => scrollTo('section-a')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#1E293B',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <Building2 size={16} color="#64748B" />
                {!sidebarCollapsed && <span>Sección A: Datos de Firma</span>}
              </button>

              <button
                onClick={() => scrollTo('section-b')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#1E293B',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Users size={16} color="#4F46E5" />
                  {!sidebarCollapsed && <span>Sección B: Depto & B10</span>}
                </div>
                {!sidebarCollapsed && (
                  <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.65rem', background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: '4px' }}>
                    {b10WordCount}w
                  </span>
                )}
              </button>

              <button
                onClick={() => scrollTo('section-c')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#1E293B',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <Award size={16} color="#64748B" />
                {!sidebarCollapsed && <span>Sección C: Mercado</span>}
              </button>

              <button
                onClick={() => scrollTo('section-d')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#1E293B',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Briefcase size={16} color="#16A34A" />
                  {!sidebarCollapsed && <span>D. Asuntos Públicos</span>}
                </div>
                {!sidebarCollapsed && (
                  <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.65rem', background: '#DCFCE7', color: '#16A34A', padding: '1px 6px', borderRadius: '4px' }}>
                    {categorized.pub.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => scrollTo('section-e')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#1E293B',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Lock size={16} color="#D97706" />
                  {!sidebarCollapsed && <span>E. Asuntos Confidenciales</span>}
                </div>
                {!sidebarCollapsed && (
                  <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.65rem', background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '4px' }}>
                    {categorized.conf.length}
                  </span>
                )}
              </button>

              {!sidebarCollapsed && (
                hasRunOptimization ? (
                  categorized.pruned.length > 0 && (
                    <button
                      onClick={() => scrollTo('section-pruned')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: '#64748B',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Sliders size={16} color="#94A3B8" />
                        <span>Fuera de selección</span>
                      </div>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.65rem', background: '#F1F5F9', color: '#64748B', padding: '1px 6px', borderRadius: '4px' }}>
                        {categorized.pruned.length}
                      </span>
                    </button>
                  )
                ) : (
                  matters.length > 20 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        color: '#94A3B8',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        width: '100%'
                      }}
                      title="Al optimizar con IA, el Audit Estratégico seleccionará los mejores asuntos y derivará excedentes a reserva."
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Sliders size={16} color="#CBD5E1" />
                        <span>Reserva</span>
                      </div>
                      <span style={{ fontSize: '0.6rem', background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        Por calibrar con IA
                      </span>
                    </div>
                  )
                )
              )}
            </div>

            {/* Verified Badge */}
            {!sidebarCollapsed && (
              <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid #F1F5F9' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '0.75rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck size={14} color="#16A34A" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0F172A' }}>Anclaje Factual</span>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                    Revisa cada cifra y atribución contra su fuente antes de aprobar la entrega.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER CANVAS (CARDS & PREVIEW) ── */}
          <div className="studio-canvas" style={{ flex: 1, padding: '2rem', maxWidth: '54rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div id="studio-delivery-review" style={{scrollMarginTop:100}}>
              {isOptimizingAll ? <section role="status" className="studio-review-panel"><strong>Optimización y revisión en curso</strong><p>{optimizeAllProgress?.stage} Las redacciones guardadas se conservan.</p></section> : reviewPanel}
            </div>
            <details id="studio-research-period" className="studio-review-panel" aria-label="Periodo de trabajo del submission" style={{padding:'1rem',border:'1px solid #CBD5E1',borderRadius:10}}>
              <summary style={{cursor:'pointer',fontWeight:600}}>Periodo del directorio · opcional para optimizar</summary>
              <p>Sirve para comprobar si la actividad de los asuntos corresponde al periodo solicitado. Puedes optimizar sin completarlo; la cobertura temporal quedará sin verificar. Añádelo solo si conoces las fechas de las instrucciones del directorio.</p>
              <label>Desde <input aria-label="Inicio del periodo" type="date" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} /></label>
              <label>Hasta <input aria-label="Fin del periodo" type="date" value={periodTo} onChange={e=>setPeriodTo(e.target.value)} /></label>
              <button type="button" disabled={isSavingDraft} onClick={()=>void saveResearchPeriod()}>Guardar periodo</button>
            </details>
            <section id="studio-ranking-review" className="studio-review-panel" aria-label="Verificación oficial del ranking" style={{padding:'1rem',border:'1px solid #CBD5E1',borderRadius:10}}>
              <strong>Verificación oficial del ranking</strong>
              <p>Al optimizar todo, consultamos la fuente oficial con la firma, el directorio, la práctica y el país ya seleccionados. Sin una edición específica, comparamos la tabla pública actual.</p>
              <details><summary style={{cursor:'pointer'}}>Corregir datos o reintentar la consulta</summary>
              <label style={{display:'block'}}>Posición declarada <input aria-label="Posición declarada" value={declaredRanking} onChange={e=>setDeclaredRanking(e.target.value)} placeholder="Ej. Band 2 o Tier 2" style={{maxWidth:'100%'}} /></label>
              <label style={{display:'block'}}><input type="checkbox" checked={rankingEdition==='current'} onChange={e=>setRankingEdition(e.target.checked?'current':'')} /> Comparar con la tabla pública actual (sin afirmar una edición histórica)</label>
              {rankingEdition!=='current' && <label>Edición del ranking <input aria-label="Edición del ranking" value={rankingEdition} onChange={e=>setRankingEdition(e.target.value)} placeholder="Ej. 2026" maxLength={4} style={{maxWidth:'100%'}} /></label>}
              <label style={{display:'block'}}>País de la tabla <input aria-label="País de la tabla" value={rankingCountry} onChange={e=>setRankingCountry(e.target.value)} placeholder="Ej. Mexico" style={{maxWidth:'100%'}} /></label>
              <button type="button" disabled={checkingRanking} onClick={()=>void checkRanking()}>{checkingRanking?'Consultando fuente oficial…':'Guardar declaración y verificar'}</button>
              </details>
              <p role="status">{chambersData.ranking_verification?.message || 'La consulta se realizará durante la revisión de la optimización.'}</p>
              {chambersData.ranking_verification?.observed_band && <p>Posición observada: {chambersData.ranking_verification.observed_band}. Edición de la fuente: {chambersData.ranking_verification.evidence?.edition || 'No acreditada'}.</p>}
              {chambersData.ranking_verification?.individuals?.length > 0 && <details><summary>Verificación individual de candidatos</summary>
                <p>Se contrasta persona y firma en la misma tabla oficial, sin otra llamada de IA. Un ranking en otra práctica o edición no se transfiere a esta candidatura.</p>
                <ul>{chambersData.ranking_verification.individuals.map((item:any,index:number)=><li key={index}><strong>{item.lawyer_name}</strong>: {String(item.status).startsWith('verified') ? `${item.observed_band} · ${item.practice_area} · ${item.jurisdiction} · ${item.evidence?.edition || 'tabla actual'}` : item.message}</li>)}</ul>
              </details>}
              {/^https:\/\/(www\.)?(chambers|legal500)\.com\//.test(chambersData.ranking_verification?.evidence?.source_url || '') && <a href={chambersData.ranking_verification.evidence.source_url} target="_blank" rel="noopener noreferrer">Consultar tabla oficial</a>}
            </section>
            {pendingInputMatters.length > 0 && <section className="studio-review-panel" aria-label="Datos pendientes de confirmar" style={{background: '#FFFBEB', borderColor: '#FCD34D'}}>
              <strong>{pendingInputMatters.length} asuntos necesitan tu revisión</strong>
              <p>Resuelve los permisos y los montos en el asistente. Tus decisiones se guardarán juntas antes de optimizar.</p>
              <button type="button" onClick={() => {setReviewPending(true); setShowValidationWizard(true);}}>Resolver pendientes en el asistente <ArrowRight size={16} /></button>
            </section>}
            {/* ═══ MASTER ACTION HERO BANNER: OPTIMIZAR TODO CON IA ═══ */}
            <div style={{
              background: 'linear-gradient(135deg, #1A237E 0%, #283593 50%, #312E81 100%)',
              borderRadius: '14px',
              padding: '1.5rem 2rem',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -5px rgba(26, 35, 126, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      background: 'rgba(255,255,255,0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      color: '#E0E7FF'
                    }}>
                      Flujo de Trabajo Interactivo SaaS
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#93C5FD' }}>
                      • Vista Previa Inmediata
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                    {isFullyOptimized ? 'Borrador optimizado — consulta la revisión' : 'Optimización Estratégica Integral'}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#C7D2FE', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                    {isFullyOptimized 
                      ? `Redacción guardada para ${optimizedMattersCount}/${targetMattersCount} asuntos. B10: ${b10WordCount} palabras. ${deliveryState.label}.`
                      : 'Reescribe la Sección B10 bajo los 4 Pilares Institucionales y transforma cada asunto en prosa orgánica de 3 párrafos (Asset/Scale → Craft/Outcome → Team/Precedent).'}
                  </p>

                  {/* Evidence Readiness Interactive Bar */}
                  <div
                    onClick={() => setShowReadinessModal(true)}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.85rem',
                      marginTop: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                    title="Haz clic para ver el Diagnóstico de Suficiencia de Evidencia"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        background: readiness.color,
                        color: '#FFFFFF',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {readiness.score}%
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#E0E7FF' }}>
                        Salud de Evidencia: {readiness.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#C7D2FE' }}>
                        ({readiness.missingElements.mattersWithoutClient} sin cliente, {readiness.missingElements.mattersWithoutValue} sin monto)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#93C5FD', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      Diagnóstico y Checklist →
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleSaveDraftAndExit()}
                    disabled={isSavingDraft || isOptimizingAll}
                    title="Guarda los cambios actuales y vuelve al panel de submissions para continuar más tarde"
                    style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.28)',
                      borderRadius: '10px',
                      padding: '0.85rem 1.35rem',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: (isSavingDraft || isOptimizingAll) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Save size={16} />
                    {isSavingDraft ? 'Guardando...' : 'Guardar y Continuar Después'}
                  </button>

                  <button
                    onClick={() => handleOptimizeAll(false)}
                    disabled={isOptimizingAll}
                    style={{
                      background: isOptimizingAll ? 'rgba(255,255,255,0.2)' : isFullyOptimized ? '#EEF2FF' : '#FFFFFF',
                      color: isOptimizingAll ? '#FFFFFF' : '#1A237E',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.85rem 1.75rem',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      cursor: isOptimizingAll ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      boxShadow: isOptimizingAll ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isOptimizingAll ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Optimizando Submission...
                      </>
                    ) : isFullyOptimized ? (
                      <>
                        <RefreshCw size={16} />
                        ↻ Reintentar revisión
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} color="#4F46E5" />
                        ✨ Optimizar Todo el Submission
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Real-time Live Progress Bar */}
              {optimizeAllProgress && (
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: '#E0E7FF' }}>
                    <span style={{ fontWeight: 600 }}>{optimizeAllProgress.stage}</span>
                    <span style={{ fontWeight: 700 }}>{optimizeAllProgress.current} / {optimizeAllProgress.total}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.round((optimizeAllProgress.current / Math.max(1, optimizeAllProgress.total)) * 100))}%`,
                      height: '100%',
                      background: '#38BDF8',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Pre-flight Portfolio Strategy Bar */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hasRunOptimization ? '#4F46E5' : '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Curaduría Estratégica de Portafolio
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: hasRunOptimization ? '#EEF2FF' : '#FEF3C7',
                    color: hasRunOptimization ? '#4338CA' : '#B45309',
                    border: `1px solid ${hasRunOptimization ? '#C7D2FE' : '#FDE68A'}`
                  }}>
                    {hasRunOptimization ? '✓ Calibrado con IA' : '⏳ Por calibrar con IA'}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.35rem 0' }}>
                  {!hasRunOptimization
                    ? `Portafolio Extraído: ${matters.length} Asuntos (${rawPubMatters.length} Públicos, ${rawConfMatters.length} Confidenciales)`
                    : showCoreOnly
                      ? `Mostrando Selección Principal de ${coreCount} Asuntos (Calibrado con IA)`
                      : `Mostrando los ${matters.length} Asuntos del Portafolio Completo`
                  }
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, maxWidth: '640px', lineHeight: 1.45 }}>
                  {!hasRunOptimization
                    ? `El registro conserva ${matters.length} asuntos. La revisión editorial comparará su evidencia y aportación al portafolio antes de confirmar la selección y las reservas.`
                    : (paLowerSS.includes('real estate') || paLowerSS.includes('inmobiliario') || paLowerSS.includes('dispute') || paLowerSS.includes('litig')
                      ? `RankPilot ha priorizado un núcleo curado de ${coreCount} asuntos (${curation.officialPubMatters.length} públicos y ${curation.officialConfMatters.length} confidenciales) para concentrar el impacto evaluativo y evitar dilución con materias ajenas.`
                      : `RankPilot seleccionó ${coreCount} asuntos (${curation.officialPubMatters.length} públicos y ${curation.officialConfMatters.length} confidenciales). Consulta en el Audit la justificación de la selección y las reservas.`
                    )
                  }
                </p>
              </div>

              {/* Shortlist Toggle Switch or Pending Badge */}
              {hasRunOptimization ? (
                <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
                  <button
                    onClick={() => setShowCoreOnly(true)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: showCoreOnly ? '#FFFFFF' : 'transparent',
                      color: showCoreOnly ? '#1A237E' : '#64748B',
                      fontWeight: showCoreOnly ? 700 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: showCoreOnly ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    Core {coreCount} (Recomendado)
                  </button>
                  <button
                    onClick={() => setShowCoreOnly(false)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: !showCoreOnly ? '#FFFFFF' : 'transparent',
                      color: !showCoreOnly ? '#1A237E' : '#64748B',
                      fontWeight: !showCoreOnly ? 700 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: !showCoreOnly ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    Todos ({matters.length})
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  padding: '0.5rem 0.85rem',
                  color: '#92400E',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  <span>⚡ Calibración pendiente al Optimizar con IA</span>
                </div>
              )}
            </div>

            {/* ═══ SECTION A: PRELIMINARY INFORMATION ═══ */}
            <div id="section-a" style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>A</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Información Preliminar (A1 - A4)</h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={14} /> Datos registrados
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.2rem' }}>A1. Firma</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                    {chambersData.firm_name || chambersData.firmName || submission.practiceArea || 'Firma Registrada'}
                  </span>
                </div>
                <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.2rem' }}>A2. Área de Práctica</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                    {submission.practiceArea || 'Área General'}
                  </span>
                </div>
                <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.2rem' }}>A3. Jurisdicción / Guía</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                    {chambersData.detectedJurisdiction || submission.guideRegion || 'Nacional'}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ SECTION B: DEPARTMENT STRUCTURE & LEADERSHIP (B1 - B9) ═══ */}
            <div id="section-b" style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>B</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Estructura del Departamento & Liderazgo (B1 – B9)
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0 }}>
                      Desglose institucional de equipo, socios directores y movimientos conforme a la plantilla oficial de Chambers
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                  Chambers Structure
                </span>
              </div>

              {/* Grid with B1, B2/B3, B8, B9 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: '#F8FAFC', padding: '0.75rem 0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.15rem' }}>
                    B1. Nombre del Departamento
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                    {departmentName}
                  </span>
                </div>

                <div style={{ background: '#F8FAFC', padding: '0.75rem 0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.15rem' }}>
                    B2 & B3. Socios & Abogados
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                    {numPartners !== null ? `${numPartners} Socios` : 'Socios registrados'} · {numLawyers !== null ? `${numLawyers} Abogados` : 'Equipo legal'}
                  </span>
                </div>

                <div style={{ background: '#F8FAFC', padding: '0.75rem 0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.15rem' }}>
                    B8. Movimientos (12 meses)
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                    {hiresList.length > 0 ? `${hiresList.length} movimiento(s)` : 'Sin movimientos de socios'}
                  </span>
                </div>

                <div style={{ background: '#F8FAFC', padding: '0.75rem 0.85rem', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.15rem' }}>
                    B9. Abogados Evaluados
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                    {lawyersList.length > 0 ? `${lawyersList.length} abogados en roster` : 'Acreditados en mandatos'}
                  </span>
                </div>
              </div>

              {/* B7: Head or Heads of Department (Special Chambers Table Row) */}
              <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Briefcase size={14} color="#4F46E5" /> B7. Head or Heads of Department (Directores / Socios Líderes)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                    Contacto de entrevistas para investigadores de Chambers
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {departmentHeads.length > 0 ? (
                    departmentHeads.map((h: any, idx: number) => (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 2fr 1.5fr',
                        background: '#FFFFFF',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #EEF2FF',
                        fontSize: '0.82rem',
                        alignItems: 'center'
                      }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>
                          {h.name || 'Socio Director'}
                        </div>
                        <div style={{ color: '#4F46E5', fontSize: '0.78rem' }}>
                          {h.email || '—'}
                        </div>
                        <div style={{ color: '#64748B', textAlign: 'right', fontSize: '0.78rem' }}>
                          {h.phone || '—'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontStyle: 'italic', padding: '0.25rem 0' }}>
                      Datos de contacto de socios líderes extraídos de los mandatos y plantilla preliminar.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ SECTION B10: STRATEGIC DEPARTMENT POSITIONING (THE HERO CARD) ═══ */}
            <div id="section-b10" style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1.5px solid #C7D2FE',
              padding: '1.75rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #EEF2FF', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>B</span>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      B10: Posicionamiento Institucional del Departamento
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                      ¿Por qué destaca este departamento? — What is this department best known for? (Límite estricto de 500 palabras)
                    </p>
                  </div>
                </div>

                {/* Word count & 4 pillars tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    background: b10WordCount <= 500 ? '#EEF2FF' : '#FEF2F2',
                    color: b10WordCount <= 500 ? '#4F46E5' : '#DC2626',
                    border: `1px solid ${b10WordCount <= 500 ? '#C7D2FE' : '#FECACA'}`
                  }}>
                    {b10WordCount} / 500 palabras
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1rem' }}>
                La narrativa usa la evidencia disponible sobre la práctica, sus mandatos y el equipo. El Audit detalla los datos que faltan.
              </p>

              {/* B10 Narrative Prose */}
              <div style={{
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                padding: '1.25rem',
                fontSize: '0.88rem',
                lineHeight: 1.7,
                color: '#1E293B',
                whiteSpace: 'pre-line',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                {b10Text || 'Cargando texto de posicionamiento del departamento...'}
              </div>

              {/* Micro-optimization Drawer for B10 */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#F1F5F9', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Sparkles size={14} color="#4F46E5" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                    Revisar la redacción del departamento
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Instrucción de ajuste (ej: enfatizar experiencia en Durango o litigio DIAGEO)..."
                    value={b10Directive}
                    onChange={(e) => setB10Directive(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.82rem',
                      color: '#0F172A',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleOptimizeB10}
                    disabled={isOptimizingB10}
                    style={{
                      background: '#4F46E5',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: isOptimizingB10 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isOptimizingB10 ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Optimizando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Revisar redacción de B10
                      </>
                    )}
                  </button>
                </div>

                {b10SuccessMsg && (
                  <p style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600, margin: '0.5rem 0 0 0' }}>
                    {b10SuccessMsg}
                  </p>
                )}
              </div>
            </div>

            {/* ═══ SECTION C: MARKET FEEDBACK & POSITIONING (C1 - C2) ═══ */}
            <div id="section-c" style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>C</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Sección C: Visión de Mercado & Retroalimentación (C1 – C2)
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0 }}>
                      Retroalimentación estratégica y defensibilidad de banda ante los investigadores de Chambers
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                  Strategic Positioning
                </span>
              </div>

              {/* C2 Box */}
              <div style={{ background: '#F8FAFC', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Award size={14} color="#4F46E5" /> C2 — Feedback on our coverage of this practice area (Optional)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                    {c2Text.includes('telephone interview') ? 'Respuesta estándar segura' : 'Posicionamiento estratégico calibrado'}
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', lineHeight: 1.6, color: '#1E293B', margin: 0, whiteSpace: 'pre-line' }}>
                  {c2Text}
                </p>
              </div>
            </div>

            {/* ═══ SECTION D: PUBLISHABLE WORK HIGHLIGHTS ═══ */}
            <div id="section-d" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#16A34A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>D</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        D. Asuntos Públicos ({categorized.pub.length})
                      </h3>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: hasRunOptimization ? '#DCFCE7' : '#FEF3C7',
                        color: hasRunOptimization ? '#166534' : '#B45309',
                        border: `1px solid ${hasRunOptimization ? '#BBF7D0' : '#FDE68A'}`
                      }}>
                        {hasRunOptimization ? '✓ Calibrado' : '⏳ Por calibrar con IA'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                      Redacción basada en las fuentes; distingue el trabajo realizado, el estado y los resultados acreditados.
                    </p>
                  </div>
                </div>
              </div>

              {/* D0: Publishable Clients List */}
              {pubClients.length > 0 && (
                <div style={{
                  background: '#F0FDF4',
                  borderRadius: '8px',
                  border: '1px solid #BBF7D0',
                  padding: '0.85rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      D0 — Publishable Clients ({pubClients.length})
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#15803D' }}>
                      Acreditados para publicación oficial
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {pubClients.map((clientName, cIdx) => (
                      <span key={cIdx} style={{
                        fontSize: '0.74rem',
                        background: '#FFFFFF',
                        border: '1px solid #86EFAC',
                        color: '#14532D',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {clientName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {categorized.pub.map((m, idx) => {
                const key = m.id || `matter-pub-${idx}`;
                const rawText = m.optimizedText || m.optimized_text || m.rawNotes || '';
                const paragraphs = rawText.split(/\n\s*\n/).filter(Boolean);
                const isOptimizingThis = optimizingMatterId === key;
                const isDrawerOpen = activeMatterDrawer === key;
                const isHeroThisMatter = Boolean(
                  (flagshipMatter && (
                    (flagshipMatter.id && m.id && String(flagshipMatter.id) === String(m.id)) ||
                    (flagshipMatter.client && m.client && flagshipMatter.client.toLowerCase() === m.client.toLowerCase()) ||
                    (flagshipMatter.name && m.name && flagshipMatter.name.toLowerCase() === m.name.toLowerCase())
                  )) ||
                  m.isHero ||
                  (m as any).is_hero ||
                  (m as any).hero
                );

                return (
                  <div key={key} id={`matter-card-${m.id || key}`} style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: isHeroThisMatter ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                    padding: '1.5rem',
                    boxShadow: isHeroThisMatter ? '0 4px 12px rgba(245, 158, 11, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'all 0.2s ease'
                  }}>
                    {/* Matter Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '4px' }}>
                            D{idx + 1} · Público
                          </span>
                          {isHeroThisMatter && (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: '#FEF3C7',
                              color: '#92400E',
                              border: '1px solid #FCD34D',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ⭐ Asunto Insignia
                            </span>
                          )}
                          {(hasPendingValue(m) || m.value) ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '4px' }}>
                              {displayedMatterValue(m)}
                            </span>
                          ) : (
                            editingMatterField?.matterId === (m.id || key) && editingMatterField?.field === 'value' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="text"
                                  placeholder="Ej. USD 3,400,000"
                                  value={editingMatterField.value}
                                  onChange={(e) => setEditingMatterField({ ...editingMatterField, value: e.target.value })}
                                  style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #4F46E5', width: '120px' }}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateMatterField(m.id || key, 'value', editingMatterField.value);
                                    if (e.key === 'Escape') setEditingMatterField(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleUpdateMatterField(m.id || key, 'value', editingMatterField.value)}
                                  style={{ background: '#16A34A', color: '#FFF', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer' }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingMatterField(null)}
                                  style={{ background: '#94A3B8', color: '#FFF', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer' }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingMatterField({ matterId: m.id || key, field: 'value', value: '' })}
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  background: '#FEF3C7',
                                  color: '#B45309',
                                  border: '1px dashed #F59E0B',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="Agregar cuantía económica estimada para este asunto"
                              >
                                + Agregar Monto
                              </button>
                            )
                          )}
                          {m.leadPartner && (
                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                              Socio: <strong style={{ color: '#0F172A' }}>{m.leadPartner}</strong>
                            </span>
                          )}
                          {/* Evidence Readiness Badges */}
                          {getMatterBadges(m).map((badge, bIdx) => (
                            <span key={bIdx} style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: badge.bg,
                              color: badge.color,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              {badge.icon && <span>{badge.icon}</span>}
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                          {m.client || m.name || `Asunto ${idx + 1}`}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {isHeroThisMatter ? (
                          <span style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#92400E',
                            background: '#FEF3C7',
                            border: '1px solid #FCD34D',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ⭐ Insignia Principal
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetHeroMatter(m)}
                            title="Designar este asunto como el Mandato Insignia / Flagship de la postulación"
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#FCD34D';
                              e.currentTarget.style.color = '#92400E';
                              e.currentTarget.style.background = '#FFFBEB';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#CBD5E1';
                              e.currentTarget.style.color = '#475569';
                              e.currentTarget.style.background = '#FFFFFF';
                            }}
                          >
                            <span>⭐</span>
                            Hacer Insignia
                          </button>
                        )}

                        <button
                          onClick={() => setActiveMatterDrawer(isDrawerOpen ? null : key)}
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Sparkles size={12} color="#4F46E5" />
                          {isDrawerOpen ? 'Cerrar Ajuste' : 'Ajustar con IA'}
                        </button>
                      </div>
                    </div>

                    {/* Matter Body (3 Organic Paragraphs) */}
                    <div style={{
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #F1F5F9',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      fontSize: '0.85rem',
                      lineHeight: 1.65,
                      color: '#1E293B'
                    }}>
                      {paragraphs.length > 0 ? (
                        paragraphs.map((p: string, pIdx: number) => (
                          <p key={pIdx} style={{ margin: 0 }}>
                            {p}
                          </p>
                        ))
                      ) : (
                        <p style={{ margin: 0, color: '#94A3B8', fontStyle: 'italic' }}>
                          Sin descripción disponible para este asunto.
                        </p>
                      )}
                    </div>

                    {/* Inline Re-optimization Drawer */}
                    {isDrawerOpen && (
                      <div style={{
                        background: '#EEF2FF',
                        borderRadius: '8px',
                        border: '1px solid #C7D2FE',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Zap size={14} color="#4F46E5" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E1B4B' }}>
                            Ajuste Quirúrgico del Asunto D{idx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Instrucción (ej: precisar fecha julio 2024 o destacar suspensión)..."
                            value={matterDirectives[key] || ''}
                            onChange={(e) => setMatterDirectives({ ...matterDirectives, [key]: e.target.value })}
                            style={{
                              flex: 1,
                              padding: '0.4rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.8rem',
                              color: '#0F172A',
                              background: '#FFFFFF'
                            }}
                          />
                          <button
                            onClick={() => handleOptimizeMatter(m, idx)}
                            disabled={isOptimizingThis}
                            style={{
                              background: '#4F46E5',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: isOptimizingThis ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isOptimizingThis ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                Optimizando...
                              </>
                            ) : (
                              <>
                                <Zap size={12} />
                                Revisar redacción
                              </>
                            )}
                          </button>
                        </div>

                        {matterSuccessMsg[key] && (
                          <p style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 600, margin: 0 }}>
                            {matterSuccessMsg[key]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ═══ SECTION E: CONFIDENTIAL WORK HIGHLIGHTS ═══ */}
            {categorized.conf.length > 0 && (
              <div id="section-e" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#D97706', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>E</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        E. Asuntos Confidenciales ({categorized.conf.length})
                      </h3>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: hasRunOptimization ? '#DCFCE7' : '#FEF3C7',
                        color: hasRunOptimization ? '#166534' : '#B45309',
                        border: `1px solid ${hasRunOptimization ? '#BBF7D0' : '#FDE68A'}`
                      }}>
                        {hasRunOptimization ? '✓ Selección revisada' : '⏳ Por calibrar con IA'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                      Para uso exclusivo de la investigación de rankings — No se publican en el directorio.
                    </p>
                  </div>
                </div>

                {categorized.conf.map((m, idx) => {
                  const key = m.id || `matter-conf-${idx}`;
                  const rawText = m.optimizedText || m.optimized_text || m.rawNotes || '';
                  const paragraphs = rawText.split(/\n\s*\n/).filter(Boolean);
                  const isOptimizingThis = optimizingMatterId === key;
                  const isDrawerOpen = activeMatterDrawer === key;
                  const isHeroThisMatter = Boolean(
                    (flagshipMatter && (
                      (flagshipMatter.id && m.id && String(flagshipMatter.id) === String(m.id)) ||
                      (flagshipMatter.client && m.client && flagshipMatter.client.toLowerCase() === m.client.toLowerCase()) ||
                      (flagshipMatter.name && m.name && flagshipMatter.name.toLowerCase() === m.name.toLowerCase())
                    )) ||
                    m.isHero ||
                    (m as any).is_hero ||
                    (m as any).hero
                  );

                  return (
                    <div key={key} id={`matter-card-${m.id || key}`} style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      border: isHeroThisMatter ? '2px solid #F59E0B' : '1px solid #FEF3C7',
                      padding: '1.5rem',
                      boxShadow: isHeroThisMatter ? '0 4px 12px rgba(245, 158, 11, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'all 0.2s ease'
                    }}>
                      {/* Matter Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '4px' }}>
                              E{idx + 1} · Confidencial
                            </span>
                            {isHeroThisMatter && (
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FCD34D',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                ⭐ Asunto Insignia
                              </span>
                            )}
                            {(hasPendingValue(m) || m.value) ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '4px' }}>
                                {displayedMatterValue(m)}
                              </span>
                            ) : (
                              editingMatterField?.matterId === (m.id || key) && editingMatterField?.field === 'value' ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="text"
                                    placeholder="Ej. USD 3,400,000"
                                    value={editingMatterField.value}
                                    onChange={(e) => setEditingMatterField({ ...editingMatterField, value: e.target.value })}
                                    style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #4F46E5', width: '120px' }}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateMatterField(m.id || key, 'value', editingMatterField.value);
                                      if (e.key === 'Escape') setEditingMatterField(null);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleUpdateMatterField(m.id || key, 'value', editingMatterField.value)}
                                    style={{ background: '#16A34A', color: '#FFF', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer' }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setEditingMatterField(null)}
                                    style={{ background: '#94A3B8', color: '#FFF', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingMatterField({ matterId: m.id || key, field: 'value', value: '' })}
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    background: '#FEF3C7',
                                    color: '#B45309',
                                    border: '1px dashed #F59E0B',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="Agregar cuantía económica estimada para este asunto"
                                >
                                  + Agregar Monto
                                </button>
                              )
                            )}
                            {/* Evidence Readiness Badges */}
                            {getMatterBadges(m).map((badge, bIdx) => (
                              <span key={bIdx} style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.color,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                {badge.icon && <span>{badge.icon}</span>}
                                {badge.label}
                              </span>
                            ))}
                          </div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                            {m.client || m.name || `Asunto Confidencial ${idx + 1}`}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {isHeroThisMatter ? (
                            <span style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#92400E',
                              background: '#FEF3C7',
                              border: '1px solid #FCD34D',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ⭐ Insignia Principal
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetHeroMatter(m)}
                              title="Designar este asunto como el Mandato Insignia / Flagship de la postulación"
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#FCD34D';
                                e.currentTarget.style.color = '#92400E';
                                e.currentTarget.style.background = '#FFFBEB';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#CBD5E1';
                                e.currentTarget.style.color = '#475569';
                                e.currentTarget.style.background = '#FFFFFF';
                              }}
                            >
                              <span>⭐</span>
                              Hacer Insignia
                            </button>
                          )}

                          <button
                            onClick={() => setActiveMatterDrawer(isDrawerOpen ? null : key)}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Sparkles size={12} color="#4F46E5" />
                            {isDrawerOpen ? 'Cerrar' : 'Ajustar con IA'}
                          </button>
                        </div>
                      </div>

                      {/* Matter Body */}
                      <div style={{
                        background: '#FFFBEB',
                        borderRadius: '8px',
                        border: '1px solid #FEF3C7',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        fontSize: '0.85rem',
                        lineHeight: 1.65,
                        color: '#78350F'
                      }}>
                        {paragraphs.length > 0 ? (
                          paragraphs.map((p: string, pIdx: number) => (
                            <p key={pIdx} style={{ margin: 0 }}>
                              {p}
                            </p>
                          ))
                        ) : (
                          <p style={{ margin: 0, color: '#94A3B8', fontStyle: 'italic' }}>
                            Sin descripción disponible.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ SECTION F: PRUNED MATTERS (ACCORDION) ═══ */}
            {categorized.pruned.length > 0 && (
              <div id="section-pruned" style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#64748B', margin: 0 }}>
                      Asuntos fuera de selección ({categorized.pruned.length})
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: 0 }}>
                      Se conservan en el expediente. Consulta en el Audit el motivo de reserva o exclusión.
                    </p>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#64748B', padding: '2px 8px', borderRadius: '4px' }}>
                    Fuera de la entrega actual
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {categorized.pruned.map((m, idx) => (
                    <div key={idx} style={{ padding: '0.6rem 0.75rem', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                        {m.client || m.name || `Asunto excedente ${idx + 21}`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        {displayedMatterValue(m)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT DRAWER: EDITORIAL COPILOT ── */}
          <div className="studio-copilot" style={{
            width: copilotCollapsed ? '50px' : '310px',
            transition: 'width 0.2s ease',
            background: '#FFFFFF',
            borderLeft: '1px solid #E2E8F0',
            position: 'sticky',
            top: '57px',
            height: 'calc(100vh - 57px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            {/* Copilot Header */}
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: copilotCollapsed ? 'center' : 'space-between'
            }}>
              {!copilotCollapsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} color="#4F46E5" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                    Editorial Copilot
                  </span>
                </div>
              )}
              <button
                onClick={() => setCopilotCollapsed(!copilotCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                  borderRadius: '4px'
                }}
              >
                {copilotCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>

            {!copilotCollapsed && (
              <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Institutional Quality Banner (Dynamic based on optimization progress) */}
                <div style={{
                  background: isFullyOptimized
                    ? 'linear-gradient(135deg, #1A237E 0%, #312E81 100%)'
                    : 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                  borderRadius: '10px',
                  padding: '1rem',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <ShieldCheck size={16} color={isFullyOptimized ? '#4ADE80' : '#38BDF8'} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: isFullyOptimized ? '#A5B4FC' : '#94A3B8' }}>
                      {isFullyOptimized ? 'Redacción guardada' : 'Borrador en preparación'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                    {deliveryState.approved && !isOptimizingAll ? 'Listo para presentación' : `${optimizedMattersCount} de ${targetMattersCount} asuntos con redacción guardada`}
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: '#C7D2FE', margin: 0, lineHeight: 1.45 }}>
                    {isOptimizingAll ? optimizeAllProgress?.stage : deliveryState.approved ? 'El documento final superó la revisión de esta versión.' : `${deliveryState.label}. ${needsB10Optimization(chambersData,b10Text) ? 'B10 conserva la redacción de origen; Optimizar Todo completará ese paso.' : 'Consulta los hallazgos del expediente antes de presentar.'}`}
                  </p>
                </div>

                {/* Surgical Recommendations List (100% Dynamic per Active Case) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Inteligencia de Caso Activa
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#6366F1', fontWeight: 600 }}>
                      {selectedDirectory}
                    </span>
                  </div>

                  {/* Card 1: B10 Institutional Positioning */}
                  <div style={{
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>💡</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                        Narrativa B10 · {practiceAreaName}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#475569', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
                      {b10WordCount === 0
                        ? `Aún no se ha generado el posicionamiento B10 para ${firmName}. Haz clic en Optimizar Todo para estructurar los 4 Pilares Institucionales.`
                        : b10WordCount > 500
                          ? `⚠️ Excede el límite estricto de 500 palabras (${b10WordCount}/500w). Reduce la extensión para cumplir el criterio de evaluación de ${selectedDirectory}.`
                          : `${b10WordCount}/500 palabras. ${needsB10Optimization(chambersData,b10Text) ? 'Conserva el texto de origen; pendiente de optimizar.' : 'Versión actual dentro del límite de extensión.'}`}
                    </p>
                    {b10Text.trim() && <p aria-label="Vista previa del B10 actual" style={{fontSize:'0.72rem',color:'#475569',lineHeight:1.45}}>{b10Text.trim().slice(0,180)}{b10Text.trim().length > 180 ? '…' : ''}</p>}
                    <button
                      onClick={() => scrollTo('section-b10')}
                      style={{
                        width: '100%',
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE',
                        padding: '0.35rem',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      Ver B10 en Canvas
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Card 2: Flagship Matter */}
                  {flagshipMatter ? (
                    <div style={{
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      padding: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem' }}>⭐</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Insignia: {formatEntityName(flagshipMatter.client || flagshipMatter.name || flagshipMatter.title)}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: '#475569', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
                        {flagshipMatter.value && flagshipMatter.value !== 'N/A' && flagshipMatter.value !== 'Not disclosed'
                          ? `Monto verificado: ${formatCleanValue(flagshipMatter.value) || flagshipMatter.value}. Estructurado en 3 párrafos orgánicos (Mandato, Desafío Técnico y Precedente).`
                          : `Asunto priorizado para ${firmName}. El Audit explica su aportación a la selección.`}
                      </p>
                      <button
                        onClick={() => scrollTo(flagshipMatter.isConfidential || (flagshipMatter as any).publish_status === 'non_publishable' ? 'section-e' : 'section-d')}
                        style={{
                          width: '100%',
                          background: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          padding: '0.35rem',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        Revisar en Asuntos
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      background: '#FAFAFA',
                      borderRadius: '8px',
                      border: '1px dashed #CBD5E1',
                      padding: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem' }}>⭐</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>
                          {hasRunOptimization ? 'Sin asunto insignia designado' : 'Insignia: selección pendiente'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
                        {hasRunOptimization ? 'La selección revisada no designó un asunto insignia. Consulta la justificación en el Audit o elige un candidato para una nueva revisión.' : 'Optimizar Todo revisará la selección y propondrá un asunto insignia cuando haya evidencia suficiente. También puedes proponerlo con Hacer Insignia.'}
                      </p>
                      <button
                        onClick={() => scrollTo('section-d')}
                        style={{
                          width: '100%',
                          background: '#FFFFFF',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          padding: '0.35rem',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        Elegir Asunto Insignia
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}

                  {/* Card 3: Portfolio Curation & Limits */}
                  <div style={{
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>📁</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                        Curaduría ({matters.length} Asuntos)
                      </span>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: hasRunOptimization ? '#DCFCE7' : '#FEF3C7',
                        color: hasRunOptimization ? '#166534' : '#B45309'
                      }}>
                        {hasRunOptimization ? 'Calibrado' : 'Por calibrar con IA'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#475569', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
                      {!hasRunOptimization
                        ? `Se han extraído ${matters.length} asuntos íntegros (${rawPubMatters.length} públicos, ${rawConfMatters.length} confidenciales). Al ejecutar la optimización, el Audit Estratégico seleccionará el Core óptimo de hasta 20 asuntos y derivará excedentes a reserva.`
                        : `Selección de ${coreCount} asuntos (${curation.officialPubMatters.length} públicos, ${curation.officialConfMatters.length} confidenciales). Fuera de la selección: ${chambersData.canonical_matter_selection?.reserve_matter_ids?.length || 0} en reserva y ${chambersData.canonical_matter_selection?.excluded_matter_ids?.length || 0} excluidos. ${deliveryState.label}.`
                      }
                    </p>
                    {hasRunOptimization && matters.length > 20 && (
                      <button
                        onClick={() => setShowCoreOnly(!showCoreOnly)}
                        style={{
                          width: '100%',
                          background: showCoreOnly ? '#EFF6FF' : '#F1F5F9',
                          color: showCoreOnly ? '#2563EB' : '#475569',
                          border: `1px solid ${showCoreOnly ? '#BFDBFE' : '#CBD5E1'}`,
                          padding: '0.35rem',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        {showCoreOnly ? `Ver asuntos fuera de selección (${surplusCount})` : `Filtrar Core ${coreCount}`}
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>

                  {/* Card 4: Factual Source Verification */}
                  <div style={{
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    padding: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>🔒</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                        Evidencia para revisar
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, lineHeight: 1.45 }}>
                      {verifiedValuesList.length > 0
                        ? `Cifras registradas: ${verifiedValuesList.map(v => `${v.name} (${v.value})`).join(' · ')}. Comprueba su fuente antes de aprobar.`
                        : `Revisa entidades, fechas y tribunales contra las fuentes de ${firmName}.`}
                    </p>
                  </div>

                  {/* Card 5: Directory Specific Strategy */}
                  <div style={{
                    background: isLegal500 ? '#FEF3C7' : '#EFF6FF',
                    borderRadius: '8px',
                    border: `1px solid ${isLegal500 ? '#FDE68A' : '#BFDBFE'}`,
                    padding: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>{isLegal500 ? '⚖️' : '🎯'}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isLegal500 ? '#92400E' : '#1E40AF' }}>
                        Criterio {isLegal500 ? 'The Legal 500' : 'Chambers & Partners'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: isLegal500 ? '#78350F' : '#1E3A8A', margin: 0, lineHeight: 1.45 }}>
                      {isLegal500
                        ? 'Pondera el volumen transaccional de todo el equipo (socios y asociados clave) y clasifica por Tiers sectoriales.'
                        : 'Comprueba los requisitos de referentes del directorio y edición seleccionados, y la vigencia de sus datos de contacto.'}
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* ═══ EVIDENCE READINESS & QUALITY GATE MODAL (v27.0) ═══ */}
      {showReadinessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: readiness.bgColor,
                  color: readiness.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {readiness.level === 'optimal' ? <Check size={22} /> : <AlertTriangle size={22} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Diagnóstico de Madurez & Asistente de Validación
                    </h3>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: readiness.bgColor,
                      color: readiness.color,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${readiness.color}30`
                    }}>
                      {readiness.score}% campos presentes · {matters.length} asuntos
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0' }}>
                    Comprobación de datos; la aprobación final se muestra por separado
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReadinessModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Executive Assessment Card */}
              <div style={{
                background: readiness.bgColor,
                border: `1px solid ${readiness.color}40`,
                borderRadius: '10px',
                padding: '1rem 1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <Info size={18} color={readiness.color} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: readiness.color, margin: 0 }}>
                      {readiness.level === 'optimal'
                        ? 'Datos básicos presentes'
                        : readiness.level === 'warning'
                        ? 'Datos por completar'
                        : 'Añade el contenido de origen'}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#334155', margin: '0.25rem 0 0 0', lineHeight: 1.5 }}>
                      {readiness.summary}
                    </p>
                    {matters.length < 10 && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.65rem', background: '#FFFFFF', borderRadius: '6px', border: `1px solid ${readiness.color}30`, fontSize: '0.74rem', color: '#7F1D1D', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>⚠️</span>
                        <span>Hay {matters.length} asuntos cargados. La pertinencia y la evidencia se revisan individualmente; este indicador no establece un mínimo obligatorio del directorio.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PRACTICE AREA DISCREPANCY CARD (Angela / Energy vs Environmental case) */}
              {readiness.practiceDiscrepancy && readiness.practiceDiscrepancy.hasDiscrepancy && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1.5px solid #F59E0B',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} color="#D97706" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E' }}>
                        Discrepancia Temática de Práctica Detectada
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#FDE68A', color: '#B45309', padding: '2px 8px', borderRadius: '4px' }}>
                      Criterio de Categoría
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#78350F', margin: 0, lineHeight: 1.5 }}>
                    La evidencia analizada presenta alta consistencia con <strong>{readiness.practiceDiscrepancy.suggestedPractice}</strong> (debido a normativas ambientales, inspecciones PROFEPA/CONAGUA, residuos peligrosos o amparos ecológicos), mientras que la postulación está clasificada en <strong>{currentPracticeArea}</strong>. Chambers desestima asuntos fuera de categoría.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => handleSwitchPracticeArea(readiness.practiceDiscrepancy.suggestedPractice)}
                      disabled={isSwitchingPractice}
                      style={{
                        background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '7px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: isSwitchingPractice ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                      }}
                    >
                      <Sparkles size={13} />
                      {isSwitchingPractice ? 'Alineando Área...' : `⚡ Alinear Área a "${readiness.practiceDiscrepancy.suggestedPractice}" en 1 Clic`}
                    </button>
                    <span style={{ fontSize: '0.72rem', color: '#92400E' }}>
                      Actualiza la sección A y metadatos sin perder tus asuntos.
                    </span>
                  </div>
                </div>
              )}

              {/* MATTERS NEEDING DATA ATTENTION (Lista quirúrgica con botón Completar Asunto) */}
              {readiness.mattersNeedingAttention && readiness.mattersNeedingAttention.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      Asuntos que Requieren Datos Inmediatos ({readiness.mattersNeedingAttention.length})
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      Haz clic en &quot;Completar Asunto&quot; para saltar al editor
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.5rem' }}>
                    {readiness.mattersNeedingAttention.map((mStatus, idx) => (
                      <div key={mStatus.id || idx} style={{
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: mStatus.statusBadge.bgColor,
                            color: mStatus.statusBadge.color,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            {mStatus.statusBadge.label}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {mStatus.name}
                          </span>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {mStatus.missingFields.map((f, fIdx) => (
                              <span key={fIdx} style={{ fontSize: '0.67rem', color: '#B91C1C', background: '#FEE2E2', padding: '1px 5px', borderRadius: '3px' }}>
                                Falta: {f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => jumpToMatter(mStatus.id)}
                          style={{
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            border: '1px solid #C7D2FE',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '5px',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          Completar Asunto →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5-Dimensional Quality Checklist */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                  Criterios de Evaluación Editorial
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {readiness.actionableChecklist.map((item) => (
                    <div key={item.id} style={{
                      background: item.done ? '#F0FDF4' : '#F8FAFC',
                      border: `1px solid ${item.done ? '#BBF7D0' : '#E2E8F0'}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: item.done ? '#16A34A' : '#CBD5E1',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          {item.done ? '✓' : '!'}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: item.done ? '#14532D' : '#1E293B' }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: item.done ? '#15803D' : '#64748B', marginTop: '1px' }}>
                            {item.impact}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#475569', fontStyle: 'italic', marginTop: '1px' }}>
                            💡 {item.guidance}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Helpers for Quota and Partner Questionnaire */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {/* Assistant Helper */}
                <div style={{
                  background: '#EEF2FF',
                  border: '1px solid #C7D2FE',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={16} color="#4F46E5" />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#312E81' }}>
                        ¿Faltan asuntos para llegar a 10?
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#4338CA' }}>
                        Importa desde tu biblioteca de mandatos.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowReadinessModal(false);
                      setShowAssistantModal(true);
                    }}
                    style={{
                      background: '#4F46E5',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Importar Mandatos
                  </button>
                </div>

                {/* Partner Questionnaire Helper */}
                <div style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bookmark size={16} color="#2563EB" />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E40AF' }}>
                        ¿Consultar a los socios?
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#3B82F6' }}>
                        Copia cuestionario listo para WhatsApp/Email.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyPartnerQuestionnaire}
                    style={{
                      background: partnerChecklistCopied ? '#16A34A' : '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    {partnerChecklistCopied ? <Check size={12} /> : <Copy size={12} />}
                    {partnerChecklistCopied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {readiness.blockers.length>0 && <div role="status" style={{padding:'1rem',background:'#FFF7ED',borderRadius:8}}><strong>Antes de redactar:</strong><ul>{readiness.blockers.map(message=><li key={message}>{message}</li>)}</ul><p>Completa estos datos y vuelve a intentar. El borrador permanece disponible.</p></div>}

              {/* High-capacity portfolio advisory (ej. Ramos Castillo con 33 asuntos) */}
              {matters.length >= 10 && readiness.mattersNeedingAttention.length > 0 && (
                <div style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '10px',
                  padding: '0.85rem 1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={18} color="#16A34A" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>
                      Portafolio Apto para Optimización ({matters.length} Asuntos disponibles)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '0.15rem' }}>
                      Hay {matters.length - readiness.mattersNeedingAttention.length} asuntos con sus campos básicos presentes. La revisión contrastará la evidencia y propondrá cuáles incluir; completar campos no acredita por sí solo calidad editorial.
                    </div>
                  </div>
                </div>
              )}

              {/* REASSURANCE CARD: AUTO-SAVED DRAFT NOTIFICATION */}
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Save size={18} color="#16A34A" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>
                      ¿No tienes la información completa en este momento?
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '0.15rem' }}>
                      Tu borrador se guarda en tiempo real. Puedes salir con tranquilidad y retomarlo más tarde desde tu listado de submissions.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReadinessModal(false);
                    handleSaveDraftAndExit();
                  }}
                  disabled={isSavingDraft}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #86EFAC',
                    color: '#15803D',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: isSavingDraft ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Save size={13} />
                  {isSavingDraft ? 'Guardando...' : 'Guardar y Salir al Dashboard'}
                </button>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowReadinessModal(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    padding: '0.6rem 1rem',
                    borderRadius: '7px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Volver al Editor
                </button>
                <button
                  onClick={() => {
                    setShowReadinessModal(false);
                    handleSaveDraftAndExit();
                  }}
                  disabled={isSavingDraft}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #86EFAC',
                    color: '#166534',
                    padding: '0.6rem 1rem',
                    borderRadius: '7px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: isSavingDraft ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Save size={14} color="#16A34A" />
                  {isSavingDraft ? 'Guardando...' : 'Guardar y Salir'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {readiness.mattersNeedingAttention.length > 0 && readiness.level !== 'critical' && (
                  <button
                    onClick={() => {
                      if (readiness.mattersNeedingAttention[0]) {
                        jumpToMatter(readiness.mattersNeedingAttention[0].id);
                      } else {
                        setShowReadinessModal(false);
                        const el = document.getElementById('section-d');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    style={{
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      padding: '0.65rem 1rem',
                      borderRadius: '7px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    📝 Completar Asunto Faltante
                  </button>
                )}

                {readiness.level === 'critical' ? (
                  <button
                    onClick={() => {
                      setShowReadinessModal(false);
                      const el = document.getElementById('section-d');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      background: '#DC2626',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '7px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                    }}
                  >
                    Completar datos de origen →
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowReadinessModal(false);
                      handleOptimizeAll(true);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.65rem 1.35rem',
                      borderRadius: '7px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    <Sparkles size={14} />
                    Proceder con Optimización ({readiness.score}%) →
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══ IMPORT FROM MATTER ASSISTANT MODAL ═══ */}
      <ImportFromAssistantModal
        isOpen={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
        submissionId={submission.id}
        currentPracticeArea={practiceAreaName}
        onMattersImported={() => {
          window.location.reload();
        }}
      />

      {/* ═══ POST-INGESTION PROGRESSIVE VALIDATION WIZARD ═══ */}
      <PostIngestionWizardModal
        isOpen={showValidationWizard}
        recheckConfidentiality={async () => {
          const response = await fetch('/api/extract-document', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({submissionId: submission.id, mode: 'confidentiality_review'})});
          const result = await response.json();
          if (!response.ok || !result.success || !Array.isArray(result.matters)) throw new Error('No se pudo revisar la fuente.');
          return result.matters;
        }}
        reviewPending={reviewPending}
        startAtLawyers={reviewLawyersFirst}
        reviewScope={focusedReview}
        onClose={() => {setShowValidationWizard(false);setReviewLawyersFirst(false);setFocusedReview(undefined);}}
        targetDirectory={selectedDirectory}
        initialData={{
          sourceReports: chambersData.source_reports || [],
          draftRevision:Number(chambersData.draft_revision || 0),
          firmName: chambersData.firm_name || chambersData.firmName || (submission as any).firmName || '',
          practiceArea: (() => {
            const raw = chambersData?.metadata?.extracted_practice_area || chambersData?.practice_area || submission.practiceArea || '';
            return (raw.includes('SOURCE DOCUMENT') || raw.startsWith('===')) ? (submission.practiceArea || '') : raw;
          })(),
          calibratedPracticeArea: chambersData?.metadata?.calibrated_practice_area || submission.practiceArea || '',
          extractedPracticeArea: (() => {
            const raw = chambersData?.metadata?.extracted_practice_area || chambersData?.practice_area || '';
            return (raw.includes('SOURCE DOCUMENT') || raw.startsWith('===')) ? '' : raw;
          })(),
          location: chambersData.location || chambersData.jurisdiction || submission.guideRegion || '',
          b10Text: chambersData.confirmed_source_b10 ?? chambersData.original_b10 ?? '',
          lawyers: chambersData.lawyers || [],
          matters: matters
        }}
        onComplete={async (data) => {
          if (data.correctionOnly && !data.lawyersChanged && !data.mattersChanged) {setShowValidationWizard(false);setReviewLawyersFirst(false);setFocusedReview(undefined);return;}
          const changes=data.correctionOnly ? {expectedRevision:data.expectedRevision,reviewIssueMessage:focusedReview?.message,...(data.lawyersChanged ? {lawyers:data.lawyers} : {}),...(data.mattersChanged ? {matters:data.matters} : {})} : {...data,b10Text:data.b10SourceChanged?data.b10Text:undefined,confirmedSourceB10:data.b10SourceChanged?data.b10Text:undefined,expectedRevision:data.expectedRevision};
          const result=await updateSubmissionValidatedData(submission.id,changes);
          if(!result.success) throw new Error(result.error || 'No se pudo guardar la revisión.');
          setChambersData((prev:any)=>({...prev,...(!data.correctionOnly?{firm_name:data.firmName,firmName:data.firmName,practice_area:data.practiceArea}:{}),lawyers:result.lawyers || data.lawyers,matters:result.matters || data.matters,...(data.b10SourceChanged?{confirmed_source_b10:data.b10Text,enhanced_b7:data.b10Text,b7:data.b10Text}:{}),draft_revision:result.revision,review_responses:result.reviewResponses,final_review_stale:true,approved_artifact:null,release_verdict:{passed:false,status:'needs_review'}}));
          setMatters(result.matters || data.matters);
          if(data.b10SourceChanged)setB10Text(data.b10Text);
          setShowValidationWizard(false);
          setReviewLawyersFirst(false);
          setFocusedReview(undefined);
          document.getElementById('studio-delivery-review')?.scrollIntoView({behavior:'smooth',block:'start'});
          if(!data.correctionOnly && data.practiceArea && data.practiceArea!==submission.practiceArea)window.location.reload();
        }}
      />

    </div>
  );
}
