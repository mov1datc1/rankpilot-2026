import {authorizedReviewUsed,editorialTokenBudget,hasUnknownProviderUsage,spentTokens} from './recovery';
import {canBindPublicQuote} from './public-quote-binding';

const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function pendingCategoryNote(note:any,data:any):boolean {
  const people=data?.review_checkpoint?.state?.development?.candidates || [];
  return people.some((person:any,index:number)=>{
    if(person.recommendation==='present' || person.suggested_ranking!=='Category pending'
      || !String(person.category_missing_criterion || '').trim() || !String(person.submission_bio || '').trim()) return false;
    const field='candidates/'+index+'/submission_bio';
    const paths=data.review_checkpoint.state.repair_report?.corrected_paths || [];
    if(!paths.some((path:string)=>field===path || field.startsWith(path+'/'))) return false;
    const normalize=(value:any)=>String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const target=' '+normalize(person.name)+' ';
    const sourceTeam=(data.matters || []).some((matter:any)=>['teamMembers','team_members'].some(key=>(' '+normalize(matter[key])+' ').includes(target)));
    return sourceTeam && new RegExp('^'+escape(String(person.name))+"[’']s category cannot be established from the permitted biography target:",'u').test(String(note));
  });
}

function quoteResiduals(state:any,data:any):boolean {
  const notes=state.repair_report.unresolved || [];
  if(!notes.every((note:any)=>pendingCategoryNote(note,data))) return false;
  let bindings=0;
  const valid=state.errors.every((message:any)=>{
    if(String(message).startsWith('Reparación pendiente: ')) return notes.includes(String(message).slice('Reparación pendiente: '.length));
    const profile=String(message).match(/^Perfil B9: (.+): Credencial retenida ausente del B9 de esta persona\.$/);
    const personal=String(message).match(/^Caso personal B9: (.+): La contribución personal debe ejecutarse literalmente en el B9 de esta persona\.$/);
    if(!profile && !personal) return false;
    const index=state.development.candidates.findIndex((c:any)=>c.name===(profile || personal)![1]);
    if(index<0) return false;
    const candidate=state.development.candidates[index],field='candidates/'+index;
    if(!state.repair_report.corrected_paths.some((path:string)=>path===field || path.startsWith(field+'/'))) return false;
    const quotes=profile?(candidate.profile_coverage || []).filter((p:any)=>['retain','generalize'].includes(p.decision)):candidate.submission_case_coverage || [];
    if(!quotes.length || !quotes.every((q:any)=>canBindPublicQuote(q.public_quote,candidate.submission_bio,candidate.name))) return false;
    bindings++;return true;
  });
  return valid && bindings>0;
}

/** A legacy repair could omit structured targets from its residual queue.
 * Recover only that unused opportunity, never a field already retried. */
function skippedStructuredResiduals(state:any):boolean {
  const report=state?.repair_report,failed=report?.failed_paths,attempted=report?.retry_paths;
  if(report?.surgical_retries!==1 || report.unresolved?.length || !Array.isArray(failed) || !failed.length
    || !Array.isArray(attempted) || state.selection_validated!==true || state.selection_review_validated!==true
    || (state.repair_feedback || []).some((d:any)=>d.severity==='critical' || d.artifact_quote))return false;
  return failed.every((path:any)=>['case_plan','institutional_execution'].includes(path)
    && state.development?.[path] && !attempted.some((p:any)=>p===path || String(p).startsWith(path+'/')));
}

/** One explicit continuation of a legacy local wording residual after a code
 * fix. It keeps the same source, cursor, ledger and normal token budget. New
 * repairs handle this residual inside their own bounded correction call. */
export function canResumeEditorialResidual(job:any,data:any,sourceHash:string,commit:string):boolean {
  const state=data?.review_checkpoint?.state,report=state?.repair_report;
  if(!job || job.status!=='failed' || job.stage!=='development' || job.sourceHash!==sourceHash
    || job.issue?.code!=='DEVELOPMENT_REJECTED' || job.issue?.owner!=='rankpilot'
    || job.issue?.retryable!==true || !commit || commit==='local'
    || !job.ledger?.length || job.ledger.at(-1)?.worker_commit===commit
    || job.ledger.some((entry:any)=>entry.status==='residual_recovery_requested')
    || hasUnknownProviderUsage(job.ledger) || hasUnknownProviderUsage([{trace:state?.trace}])
    || !Array.isArray(state?.trace) || !state.trace.length
    || state.trace.some((call:any)=>typeof call?.usage?.total_tokens!=='number' || call.usage.total_tokens<0)
    || authorizedReviewUsed(job.ledger) || spentTokens(job.ledger)>=editorialTokenBudget(job.ledger)
    || !state?.development || state.development_validated===true
    || !report?.corrected_paths?.length
    || !Array.isArray(state.errors) || !state.errors.length) return false;
  if(skippedStructuredResiduals(state))return true;
  if(report.surgical_retries!==0
    || report.failed_paths?.length
    || state.errors.length>3) return false;
  const voice=!report.unresolved?.length && state.errors.every((message:any)=>{
    const match=String(message).match(/^Voz auditora en Submission: (b10|c2|candidates\/\d+\/submission_bio|matters\/\d+\/(?:text|completion_status))$/);
    if(!match || !report.corrected_paths.some((parent:string)=>match[1]===parent || match[1].startsWith(parent+'/'))) return false;
    let value:any=state.development;
    for(const part of match[1].split('/'))value=value?.[part];
    return typeof value==='string' && value.trim().length>0;
  });
  return voice || quoteResiduals(state,data);
}
