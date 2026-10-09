import {stableHash} from './contracts';

/** Ignore packaging timestamps: progress means changed generated content. */
export function generatedContentHash(data:any):string {
  return stableHash({development:data.editorial_development,letter:data.editorial_review?.letter,b10:data.enhanced_b7,
    matters:(data.matters || []).map((m:any)=>({id:m.id,text:m.optimizedText || m.optimized_text || ''}))});
}
export function mayRepairAutomatically(ledger:any[],data:any):boolean {
  const reviews=(ledger || []).filter(e=>e.stage==='artifact' && e.generated_content_hash);
  if(reviews.length>=3) return false;
  return !reviews.length || reviews.at(-1).generated_content_hash!==generatedContentHash(data);
}

/** A known generated claim cannot silently pass while its rejected wording survives.
 * Only concrete corrections owned by RankPilot qualify. Source questions, missing
 * metadata and alias preservation remain decisions for the independent reviewer.
 */
export function unrepairedGeneratedClaims(feedback:any[],submissionText:string,auditText:string):any[] {
  const literal=(text:any)=>String(text || '').replace(/\s+/g,' ').trim();
  return (feedback || []).filter(d=>{
    if(d.owner!=='rankpilot' || !d.field_path || !d.artifact_quote || !['submission','letter'].includes(d.scope)) return false;
    const correction=(d.code==='UNSUPPORTED_CLAIM' && d.source_quote) || d.code==='EDITORIAL_STYLE' ||
      (d.code==='SOURCE_CONFLICT' && d.field_path==='client_sector' && d.conflict_resolution==='omit_nonessential_descriptor');
    return correction && literal(d.scope==='submission'?submissionText:auditText).includes(literal(d.artifact_quote));
  }).map(d=>({...d,severity:'critical',verification:'unchanged_generated_claim'}));
}
