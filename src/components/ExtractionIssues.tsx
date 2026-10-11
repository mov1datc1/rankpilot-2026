'use client';
import { pendingExtractionIssues, extractionFieldLabel } from '@/lib/audit/input-review';
/** Only evidence discrepancies are questions. Complete fields remain in the overview. */
export function ExtractionIssues({value,onChange}:{value:any;onChange:(value:any)=>void}) {
  const issues=(value.extraction_issues || []).filter((issue:any)=>issue.field!=='value');
  if(!issues.length)return null;
  const pending=pendingExtractionIssues(value);
  return <section className="review-decision" aria-label="Dudas de la extracción">
    <strong>{pending.length ? 'Datos que necesitan tu confirmación' : 'Dudas resueltas'}</strong>
    {issues.map((issue:any,index:number)=>{
      const field=issue.field;const current=String(value[field] || '');const resolution=value.extractionResolutions?.[field];
      return <fieldset key={`${field}-${index}`} style={{marginTop:12,padding:12,border:'1px solid #CBD5E1',borderRadius:8}}>
        <legend>{extractionFieldLabel(field)}</legend>
        <p>{issue.kind==='missing'?'No se encontró este dato en la fuente.':'La fuente contiene alternativas incompatibles para este dato.'}</p>
        {(issue.alternatives || []).map((alternative:string,i:number)=><blockquote key={i} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{alternative}</blockquote>)}
        <label>Dato correcto<textarea aria-label={`Dato correcto: ${extractionFieldLabel(field)}`} value={current} onChange={e=>onChange({...value,[field]:e.target.value,extractionResolutions:{...value.extractionResolutions,[field]:{value:e.target.value,confirmed:false}}})} style={{width:'100%',minHeight:70}} /></label>
        <label><input type="checkbox" disabled={!current.trim()} checked={resolution?.confirmed===true && resolution.value===current} onChange={e=>onChange({...value,extractionResolutions:{...value.extractionResolutions,[field]:{value:current,confirmed:e.target.checked}}})} /> Confirmo este dato después de revisar la fuente.</label>
      </fieldset>;
    })}
  </section>;
}
