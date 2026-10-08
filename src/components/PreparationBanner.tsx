'use client';

import { ArrowRight, CheckCircle2, FileText, LoaderCircle } from 'lucide-react';

type Props = {
  approved: boolean;
  busy: boolean;
  needsReview: boolean;
  progress?: {current:number;total:number;stage:string} | null;
  onPrepare: () => void;
  onReview: () => void;
  onAudit: () => void;
};

/** One document status and one next action; detailed findings live in the review panel. */
export function PreparationBanner({approved,busy,needsReview,progress,onPrepare,onReview,onAudit}:Props) {
  const title=busy?'Preparando documentos':approved?'Documentos revisados':needsReview?'Revisión pendiente':'Prepara tus documentos';
  const description=busy?'Estamos preparando y revisando el Submission y el Audit.':approved?'Submission y Audit disponibles en Descargar.':needsReview?'Consulta los pendientes para continuar con el Submission y el Audit.':'Genera el Submission y el Audit a partir de la información de tu expediente.';
  const Icon=busy?LoaderCircle:approved?CheckCircle2:FileText;
  const value=progress && progress.total>0 ? Math.max(0,Math.min(100,progress.current/progress.total*100)):undefined;
  return <section aria-label="Preparación de documentos" aria-busy={busy} style={{background:'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:12,padding:'1.25rem',color:'#1E1B4B'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12,flex:'1 1 260px',minWidth:0}}>
        <Icon size={22} aria-hidden="true" className={busy?'animate-spin':undefined} style={{flexShrink:0,marginTop:3,color:'#4338CA'}} />
        <div aria-live="polite">
          <h2 style={{fontSize:'1.125rem',fontWeight:700,lineHeight:1.4,margin:0,color:'#1E1B4B'}}>{title}</h2>
          <p style={{fontSize:'.875rem',lineHeight:1.5,margin:'4px 0 0',color:'#475569'}}>{description}</p>
        </div>
      </div>
      {!busy && <button type="button" onClick={approved?onAudit:needsReview?onReview:onPrepare} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,background:'#4338CA',color:'#fff',border:0,borderRadius:8,padding:'10px 16px',fontSize:'.875rem',fontWeight:600,cursor:'pointer',maxWidth:'100%'}}>
        {approved?'Ver Audit':needsReview?'Ver pendientes':'Preparar documentos'}<ArrowRight size={16} aria-hidden="true" style={{flexShrink:0}} />
      </button>}
    </div>
    {busy && <div style={{marginTop:16}}>
      <p role="status" style={{fontSize:'.8125rem',color:'#475569',margin:'0 0 8px'}}>{progress?.stage || 'Iniciando preparación…'}</p>
      <progress aria-label="Avance de la preparación" max={100} value={value} style={{display:'block',width:'100%',height:6,accentColor:'#4338CA'}} />
    </div>}
  </section>;
}
