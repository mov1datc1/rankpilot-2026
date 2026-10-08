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
