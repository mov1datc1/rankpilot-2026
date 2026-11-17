'use client';
import {useEffect,useState} from 'react';

/** Animated, honest view of the durable editorial job: four real phases, no invented percentage. */
type StageMetric={stage:string;label:string;minutes:number;tokens:number;steps:number;repairs:number};
type Activity={label:string;steps:{label:string;done:number;total:number}[];firstPassPercent:number|null;providerCalls:number;stages?:StageMetric[]};
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
  return <svg width="40" height="44" viewBox="0 0 64 70" aria-hidden="true" className="rp-bot">
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

/** What the robot says, built only from the real saved activity. */
export function botSays(progress:Progress,done:boolean,active:number):string {
  if(done) return '¡Listo! Tus documentos ya están disponibles.';
  if(progress.waiting) return 'Estoy en espera de turno; enseguida continúo.';
  const steps=progress.activity?.steps || [];
  const step=(label:string)=>steps.find(s=>s.label===label);
  const left=(s:{done:number;total:number}|undefined)=>s ? Math.max(s.total-s.done,0) : 0;
  const label=progress.activity?.label || '';
  if(active===0) return 'Estoy leyendo todos los asuntos y comparándolos con la metodología de la práctica.';
  if(active===1) {
    if(/Corrigiendo/.test(label)) { const g=step('Grupos corregidos'); return g && left(g) ? `Estoy corrigiendo unos campos: ${left(g)===1?'me queda 1 grupo':`me quedan ${left(g)} grupos`}.` : 'Estoy corrigiendo los últimos campos señalados.'; }
    if(/Preparando la revisión/.test(label)) return 'Ya terminé de redactar. Estoy aplicando las reglas editoriales y preparo la revisión campo por campo.';
    const review=step('Campos contrastados con sus fuentes');
    if(review) return left(review) ? `Reviso cada campo contra sus fuentes: van ${review.done} de ${review.total}.` : 'Terminé de revisar los campos; preparo el siguiente paso.';
    const plan=step('Plan común'),matters=step('Asuntos'),bios=step('Biografías B9'),inst=step('B10 y C2');
    if(plan && left(plan)) return 'Estoy leyendo los asuntos y armando el plan común del caso.';
    if(matters && left(matters)) return `Estoy reescribiendo cada asunto: me ${left(matters)===1?'falta 1 grupo':`faltan ${left(matters)} grupos`} de asuntos.`;
    if(bios && left(bios)) return `Estoy escribiendo las biografías B9: ${bios.done} de ${bios.total} listas.`;
    if(inst && left(inst)) return 'Estoy escribiendo el B10 y el C2 de la firma.';
    return 'Estoy redactando el Submission.';
  }
  if(active===2) return 'Estoy escribiendo el Audit con las mismas decisiones del Submission y revisándolo.';
  return 'Estoy armando los dos Word y haciendo la revisión final.';
}

export function formatMinutes(minutes:number) {return minutes<1?`${Math.max(1,Math.round(minutes*60))} s`:`${minutes.toFixed(1).replace('.',',')} min`;}
export function formatTokens(tokens:number) {return tokens>=1e6?`${(tokens/1e6).toFixed(2).replace('.',',')} M tokens`:tokens>=1e3?`${Math.round(tokens/1e3)} k tokens`:`${tokens} tokens`;}

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
  const says=botSays(progress,done,active);
  return <div style={{display:'flex',flexDirection:'column',gap:6}}>
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
      .rp-bubble{animation:rp-pop .35s ease-out}
      @keyframes rp-pop{from{opacity:0;transform:translateY(4px) scale(.96)}to{opacity:1;transform:none}}
      @keyframes rp-ring{0%{box-shadow:0 0 0 0 rgba(167,139,250,.55)}100%{box-shadow:0 0 0 14px rgba(167,139,250,0)}}
      @media (prefers-reduced-motion: reduce){.rp-bot,.rp-flame,.rp-pulse,.rp-flow,.rp-node-active,.rp-bubble{animation:none}}
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
    <div style={{position:'relative',height:84,margin:'0 8px'}}>
      <svg width="100%" height="8" style={{position:'absolute',top:58,left:0}} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="4" x2="100%" y2="4" stroke="rgba(255,255,255,.15)" strokeWidth="3"/>
        <line x1="0" y1="4" x2={`${position}%`} y2="4" stroke={done?'#34D399':'#38BDF8'} strokeWidth="3" className={done?undefined:'rp-flow'} style={{transition:'all .7s ease'}}/>
      </svg>
      <div style={{position:'absolute',top:0,left:`calc(${position}% - 20px)`,transition:'left .7s ease'}}><Robot phase={done?3:active} done={done}/></div>
      <div key={says} role="status" aria-live="polite" className="rp-bubble" style={{position:'absolute',top:-2,maxWidth:300,
        ...(position>62?{right:`calc(${100-position}% + 26px)`}:{left:`calc(${position}% + 26px)`}),
        background:'#FFFFFF',color:'#1E1B4B',borderRadius:12,padding:'6px 10px',fontSize:'0.78rem',lineHeight:1.35,fontWeight:500,
        boxShadow:'0 6px 18px rgba(15,23,42,.35)',transition:'left .7s ease, right .7s ease'}}>
        {says}
      </div>
      <div style={{position:'absolute',top:46,left:0,right:0,display:'grid',gridTemplateColumns:`repeat(${PHASES.length},1fr)`}}>
        {PHASES.map((phase,i)=>{
          const state=done||i<completedPhases?'completed':i===active?'active':'pending';
          return <button key={phase.title} type="button" onClick={()=>setOpen(open===i?null:i)} aria-expanded={open===i}
            style={{background:'none',border:0,color:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',padding:0}}>
            <span className={state==='active'?'rp-node-active':undefined} style={{width:28,height:28,borderRadius:999,display:'grid',placeItems:'center',fontWeight:700,fontSize:12,
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
          <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:8}}>{step.label}</span><span style={{fontVariantNumeric:'tabular-nums',flexShrink:0}}>{step.done} de {step.total}</span></div>
        <div style={{height:5,borderRadius:999,background:'rgba(255,255,255,.15)',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${step.total?Math.round(100*step.done/step.total):0}%`,background:step.done>=step.total?'#34D399':'#38BDF8',transition:'width .6s ease'}}/></div>
      </div>)}
      {progress.activity.firstPassPercent!==null && <span style={{fontSize:'0.74rem',background:'rgba(52,211,153,.15)',border:'1px solid rgba(52,211,153,.4)',borderRadius:999,padding:'3px 10px'}}>
        Acierto en primera redacción: {progress.activity.firstPassPercent}%</span>}
    </div>}
    {(progress.activity?.stages || []).length>0 && <div aria-label="Métricas reales por etapa" style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {(progress.activity?.stages || []).map(m=><span key={m.stage} title={`${m.steps} pasos guardados${m.repairs?` · ${m.repairs} llamadas de corrección`:''}`}
        style={{fontSize:'0.72rem',color:'#E0E7FF',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.14)',borderRadius:8,padding:'3px 8px',fontVariantNumeric:'tabular-nums'}}>
        <strong style={{fontWeight:600}}>{m.label}</strong> · {formatMinutes(m.minutes)} · {formatTokens(m.tokens)}{m.repairs?` · ${m.repairs} corr.`:''}</span>)}
    </div>}
    {open!==null && <div style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:10,padding:'8px 12px',fontSize:'0.8rem',color:'#E0E7FF'}}>
      <strong>{PHASES[open].title}.</strong> {PHASES[open].detail}
    </div>}
    <div style={{fontSize:'0.72rem',color:'#A5B4FC'}}>Puedes salir y volver: el avance se guarda solo.</div>
  </div>;
}
