'use client';
import {useEffect,useState} from 'react';

/** Animated, honest view of the durable editorial job: four real phases, no invented percentage. */
type Activity={label:string;steps:{label:string;done:number;total:number}[];firstPassPercent:number|null;providerCalls:number};
type Progress={current:number;total:number;startedAt?:string;waiting?:boolean;stage?:string;activity?:Activity|null};

const PHASES=[
  {title:'Selección del portafolio',short:'Selección',detail:'Compara los asuntos con la metodología de la práctica (RAG), elige el núcleo y el héroe, y una revisión independiente valida la selección.'},
  {title:'Redacción del Submission',short:'Redacción',detail:'Plan común, narrativas de asuntos, biografías B9 y B10/C2; después cada campo se contrasta con sus fuentes y se corrige lo necesario.'},
  {title:'Audit estratégico',short:'Audit',detail:'Construye el Audit desde las mismas decisiones del Submission, lo revisa contra las fuentes y corrige sus casillas.'},
  {title:'Revisión final y Word',short:'Documentos',detail:'Genera los dos Word y una revisión independiente comprueba coherencia, confidencialidad y fidelidad antes de dejarlos disponibles.'},
];
const ACCENT=['#38BDF8','#22D3EE','#A78BFA','#FBBF24'];

function Robot({phase,done}:{phase:number;done:boolean}) {
  const body=done?'#FBBF24':phase>=2?'#8B5CF6':'#60A5FA';
  return <svg width="64" height="70" viewBox="0 0 64 70" aria-hidden="true" className="rp-bot">
    {done && <g fill="#FDE68A" opacity="0.9"><path d="M8 34 L0 26 L4 40 Z"/><path d="M56 34 L64 26 L60 40 Z"/></g>}
    {phase>=2 && !done && <g><rect x="5" y="30" width="7" height="16" rx="3" fill="#6D28D9"/><path d="M6 46 L8.5 58 L11 46 Z" fill="#F59E0B" className="rp-flame"/></g>}
    <line x1="30" y1="4" x2="30" y2="11" stroke="#CBD5E1" strokeWidth="2"/><circle cx="30" cy="4" r="3" fill={ACCENT[phase]} className="rp-pulse"/>
    <rect x="15" y="11" width="30" height="22" rx="8" fill="#E2E8F0"/>
    {phase>=1 && !done ? <rect x="18" y="16" width="24" height="11" rx="5" fill="#0E7490" opacity="0.9"/> : null}
    <circle cx="25" cy="22" r="3.2" fill={phase>=1?'#67E8F9':'#1E3A8A'}/><circle cx="35" cy="22" r="3.2" fill={phase>=1?'#67E8F9':'#1E3A8A'}/>
    <rect x="17" y="35" width="26" height="22" rx="7" fill={body}/>
    {phase>=2 && <g fill="#FCD34D"><rect x="13" y="35" width="7" height="5" rx="2"/><rect x="40" y="35" width="7" height="5" rx="2"/></g>}
    <circle cx="30" cy="46" r="4" fill="#0F172A" opacity="0.35"/>
    <rect x="21" y="58" width="6" height="8" rx="2" fill="#94A3B8"/><rect x="33" y="58" width="6" height="8" rx="2" fill="#94A3B8"/>
    <g transform="translate(44 30) rotate(8)">
      {phase>=2 && <rect x="3" y="3" width="15" height="19" rx="2" fill="#C4B5FD"/>}
      <rect x="0" y="0" width="15" height="19" rx="2" fill="#FFFFFF"/>
      {phase>=1 ? <g stroke={done?'#059669':'#0891B2'} strokeWidth="1.4"><line x1="3" y1="5" x2="12" y2="5"/><line x1="3" y1="9" x2="12" y2="9"/><line x1="3" y1="13" x2="9" y2="13"/></g>
        : <g stroke="#CBD5E1" strokeWidth="1.2"><line x1="3" y1="6" x2="12" y2="6"/><line x1="3" y1="11" x2="12" y2="11"/></g>}
      {done && <path d="M4 10 L7 14 L13 5" stroke="#F59E0B" strokeWidth="2.4" fill="none" strokeLinecap="round"/>}
    </g>
  </svg>;
}

export function PipelineProgress({progress}:{progress:Progress}) {
  const [now,setNow]=useState<number|null>(null);
  const [open,setOpen]=useState<number|null>(null);
  useEffect(()=>{setNow(Date.now());const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const started=Date.parse(progress.startedAt || '');
  const seconds=now!==null && Number.isFinite(started)?Math.max(0,Math.floor((now-started)/1000)):null;
  const total=Math.max(progress.total || 4,1);
  // Corrections appended after the final review stay inside the last phase.
  const done=progress.current>=total;
  const active=Math.min(Math.max(progress.current,0),PHASES.length-1);
  const completedPhases=done?PHASES.length:Math.min(progress.current,PHASES.length);
  const position=done?100:((active+0.5)/PHASES.length)*100;
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    <style>{`
      .rp-bot{filter:drop-shadow(0 6px 14px rgba(56,189,248,.35));animation:rp-float 3s ease-in-out infinite}
      .rp-flame{animation:rp-flame .35s ease-in-out infinite alternate;transform-origin:8px 46px}
      .rp-pulse{animation:rp-pulse 1.6s ease-in-out infinite}
      .rp-flow{stroke-dasharray:6 8;animation:rp-flow 1.1s linear infinite}
      .rp-node-active{animation:rp-ring 2s ease-out infinite}
      @keyframes rp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      @keyframes rp-flame{from{transform:scaleY(.7)}to{transform:scaleY(1.15)}}
      @keyframes rp-pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes rp-flow{to{stroke-dashoffset:-28}}
      @keyframes rp-ring{0%{box-shadow:0 0 0 0 rgba(167,139,250,.55)}100%{box-shadow:0 0 0 14px rgba(167,139,250,0)}}
      @media (prefers-reduced-motion: reduce){.rp-bot,.rp-flame,.rp-pulse,.rp-flow,.rp-node-active{animation:none}}
    `}</style>
    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <div style={{minWidth:0}}>
        <div style={{fontWeight:700,fontSize:'0.95rem'}}>{done?'Documentos listos':`Etapa ${active+1} de ${PHASES.length} · ${PHASES[active].title}`}</div>
        <div role="status" aria-live="polite" style={{fontSize:'0.82rem',color:'#C7D2FE',marginTop:2}}>{progress.waiting?'En espera de turno · ':''}{progress.activity?.label || progress.stage || 'Trabajando…'}</div>
      </div>
      <div style={{display:'flex',gap:8,fontSize:'0.78rem'}}>
        {seconds!==null && <span style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.18)',borderRadius:999,padding:'4px 10px',fontVariantNumeric:'tabular-nums'}}>⏱ {Math.floor(seconds/60)} min {String(seconds%60).padStart(2,'0')} s</span>}
        <span style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.18)',borderRadius:999,padding:'4px 10px'}}>{completedPhases} de {PHASES.length} etapas completas</span>
      </div>
    </div>
    <div style={{position:'relative',height:128,margin:'0 8px'}}>
      <svg width="100%" height="8" style={{position:'absolute',top:96,left:0}} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="4" x2="100%" y2="4" stroke="rgba(255,255,255,.15)" strokeWidth="3"/>
        <line x1="0" y1="4" x2={`${position}%`} y2="4" stroke={done?'#34D399':'#38BDF8'} strokeWidth="3" className={done?undefined:'rp-flow'} style={{transition:'all .7s ease'}}/>
      </svg>
      <div style={{position:'absolute',top:0,left:`calc(${position}% - 32px)`,transition:'left .7s ease'}}><Robot phase={done?3:active} done={done}/></div>
      <div style={{position:'absolute',top:78,left:0,right:0,display:'grid',gridTemplateColumns:`repeat(${PHASES.length},1fr)`}}>
        {PHASES.map((phase,i)=>{
          const state=done||i<completedPhases?'completed':i===active?'active':'pending';
          return <button key={phase.title} type="button" onClick={()=>setOpen(open===i?null:i)} aria-expanded={open===i}
            style={{background:'none',border:0,color:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',padding:0}}>
            <span className={state==='active'?'rp-node-active':undefined} style={{width:38,height:38,borderRadius:999,display:'grid',placeItems:'center',fontWeight:700,fontSize:14,
              background:state==='completed'?'#059669':state==='active'?'#4C1D95':'#1E1B4B',border:`2px solid ${state==='pending'?'rgba(255,255,255,.25)':ACCENT[i]}`}}>
              {state==='completed'?'✓':i+1}</span>
            <span style={{fontSize:'0.75rem',color:state==='pending'?'#A5B4FC':'#FFFFFF',fontWeight:state==='active'?700:500,textAlign:'center'}}>{phase.short}</span>
          </button>;
        })}
      </div>
    </div>
    {!done && progress.activity && (progress.activity.steps.length>0 || progress.activity.firstPassPercent!==null) && <div style={{display:'flex',flexWrap:'wrap',gap:'8px 18px',alignItems:'center'}}>
      {progress.activity.steps.map(step=><div key={step.label} style={{minWidth:150,flex:'1 1 150px',maxWidth:260}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.74rem',color:'#E0E7FF',marginBottom:4}}>
          <span>{step.label}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{step.done} de {step.total}</span></div>
        <div style={{height:5,borderRadius:999,background:'rgba(255,255,255,.15)',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${step.total?Math.round(100*step.done/step.total):0}%`,background:step.done>=step.total?'#34D399':'#38BDF8',transition:'width .6s ease'}}/></div>
      </div>)}
      {progress.activity.firstPassPercent!==null && <span style={{fontSize:'0.74rem',background:'rgba(52,211,153,.15)',border:'1px solid rgba(52,211,153,.4)',borderRadius:999,padding:'3px 10px'}}>
        Acierto en primera redacción: {progress.activity.firstPassPercent}%</span>}
    </div>}
    {open!==null && <div style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:10,padding:'8px 12px',fontSize:'0.8rem',color:'#E0E7FF'}}>
      <strong>{PHASES[open].title}.</strong> {PHASES[open].detail}
    </div>}
    <div style={{fontSize:'0.75rem',color:'#A5B4FC'}}>El avance se guarda automáticamente. Puedes salir y volver cuando quieras.</div>
  </div>;
}
