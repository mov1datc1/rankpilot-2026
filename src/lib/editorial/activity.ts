/** Real sub-progress of the running editorial job, derived only from saved state.
 * No estimate is invented: each count comes from the checkpoint or the ledger. */
export type ActivityStep = {label:string;done:number;total:number};
export type JobActivity = {phase:number;label:string;steps:ActivityStep[];firstPassPercent:number|null;providerCalls:number};

const KIND_LABEL:Record<string,string> = {plan:'Plan común',plan_comparisons:'Comparaciones de reservas',matters:'Asuntos',bio:'Biografías B9',institutional:'B10 y C2'};

function count(units:any[]|undefined,kind:string) {return (units || []).filter((u:any)=>u?.kind===kind).length;}

export function jobActivity(job:any,chambersData:any):JobActivity|null {
  if(!job) return null;
  const phase=Math.min(Math.max(Number(job.cursor) || 0,0),3);
  const state=chambersData?.review_checkpoint?.state || {};
  const pending=state.repair_continuation || {};
  const providerCalls=(job.ledger || []).reduce((n:number,e:any)=>n+((e?.trace?.calls || (e?.trace?.usage ? [e.trace] : [])).length),0);
  const quality=state.development_build_report?.first_pass_quality || {};
  const firstPassPercent=typeof quality.percent_met==='number' ? quality.percent_met : null;
  const base={phase,providerCalls,firstPassPercent};
  if(job.stage==='selection') return {...base,label:'Comparando los asuntos con la metodología de la práctica y validando la selección',steps:[]};
  if(job.stage==='development') {
    if(pending.version==='editorial-construction-v1') {
      const done=pending.completed_units || [];
      const all=[...done,...(pending.pending_groups || [])];
      const steps=['plan','matters','bio','institutional'].map(kind=>({label:KIND_LABEL[kind],done:count(done,kind),total:count(all,kind)})).filter(s=>s.total>0);
      const current=pending.pending_groups?.[0]?.kind;
      return {...base,label:current ? `Redactando: ${KIND_LABEL[current] || 'bloque'}` : 'Ensamblando la redacción',steps};
    }
    const units=Object.values(quality.units || {}) as any[];
    const reviewed=units.filter(u=>u?.first_review).length;
    const reviewStep={label:'Campos contrastados con sus fuentes',done:reviewed,total:units.length};
    if(pending.version==='source-field-review-v1' && pending.phase==='repair') {
      const calls=Number(state.field_review_repair_calls || 0);
      const groups=(pending.pending_groups || []).length;
      return {...base,label:'Corrigiendo los hallazgos localizados',steps:[reviewStep,{label:'Grupos corregidos',done:calls,total:calls+groups}]};
    }
    return {...base,label:units.length ? 'Revisando cada campo contra sus fuentes' : 'Preparando la revisión por campos',steps:units.length ? [reviewStep] : []};
  }
  if(job.stage==='audit') return {...base,label:'Construyendo el Audit desde las decisiones compartidas y revisándolo',steps:[]};
  return {...base,phase:3,label:'Generando los Word y revisando el par final',steps:[]};
}
