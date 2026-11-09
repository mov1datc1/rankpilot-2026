'use client';

import { PreparationProgress } from './PreparationProgress';
import { ArrowRight, CheckCircle2, FileText, LoaderCircle } from 'lucide-react';

type Props = {
  approved: boolean;
  available?:boolean;
  hasObservations?:boolean;
  busy: boolean;
  needsReview: boolean;
  progress?: {current:number;total:number;stage:string;startedAt?:string;waiting?:boolean} | null;
  onPrepare: () => void;
  onReview: () => void;
  onAudit: () => void;
};

/** One document status and one next action; detailed findings live in the review panel. */
export function PreparationBanner({approved,available=approved,hasObservations=false,busy,needsReview,progress,onPrepare,onReview,onAudit}:Props) {
  const title=busy?'Preparando documentos':available?`Documentos disponibles · ${hasObservations?'con observaciones':'sin observaciones'}`:needsReview?'Preparación de documentos':'Prepara tus documentos';
  const description=busy?'Estamos preparando el Submission y el Audit. El avance se guarda automáticamente; puedes salir y volver después.':available?(hasObservations?'Abre «Descargar» para obtener ambos Word. Revisa las observaciones antes de presentarlos.':'Abre «Descargar» para obtener ambos Word. La revisión no dejó observaciones pendientes.'):needsReview?'Consulta el siguiente paso para continuar con los documentos.':'Pulsa «Preparar documentos». Recibirás el Submission y el Audit con la información de este expediente.';
  const Icon=busy?LoaderCircle:approved?CheckCircle2:FileText;
  return <section aria-label="Preparación de documentos" aria-busy={busy} style={{background:'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:12,padding:'1.25rem',color:'#1E1B4B'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12,flex:'1 1 260px',minWidth:0}}>
        <Icon size={22} aria-hidden="true" className={busy?'animate-spin':undefined} style={{flexShrink:0,marginTop:3,color:'#4338CA'}} />
        <div aria-live="polite">
          <h2 style={{fontSize:'1.125rem',fontWeight:700,lineHeight:1.4,margin:0,color:'#1E1B4B'}}>{title}</h2>
          <p style={{fontSize:'.875rem',lineHeight:1.5,margin:'4px 0 0',color:'#475569'}}>{description}</p>
        </div>
      </div>
      {!busy && <button type="button" onClick={available?(hasObservations?onReview:onAudit):needsReview?onReview:onPrepare} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,background:'#4338CA',color:'#fff',border:0,borderRadius:8,padding:'10px 16px',fontSize:'.875rem',fontWeight:600,cursor:'pointer',maxWidth:'100%'}}>
        {available?(hasObservations?'Ver observaciones':'Ver Audit'):needsReview?'Ver siguiente paso':'Preparar documentos'}<ArrowRight size={16} aria-hidden="true" style={{flexShrink:0}} />
      </button>}
    </div>
    {busy && <div style={{marginTop:16}}>
      <p role="status" style={{fontSize:'.8125rem',color:'#475569',margin:'0 0 8px'}}>{progress?.stage || 'Iniciando preparación…'}</p>
      {progress && <PreparationProgress progress={progress} />}
    </div>}
  </section>;
}
