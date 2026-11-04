import voiceRules from '../../../ai-engine/core/editorial_voice_rules.json';

/** Literal bindings let the repairer edit generated fields, never source facts.
 * A reviewer may label a source-vs-output defect 'facts'; locate its output claim
 * before routing the correction, without buying a model call to locate it. */
function generatedFields(development:any, includeInternal=false) {
  const fields:Array<{path:string,text:string,matterId?:string}>=[];
  for(const key of ['b10','c2']) if(development?.[key]) fields.push({path:key,text:development[key]});
  (development?.matters || []).forEach((m:any,i:number)=>{
    for(const key of ['text','completion_status']) if(m[key]) fields.push({path:`matters/${i}/${key}`,text:m[key],matterId:m.matter_id});
  });
  (development?.candidates || []).forEach((c:any,i:number)=>fields.push({path:`candidates/${i}/submission_bio`,text:c.submission_bio || ''}));
  if(includeInternal) (development?.candidates || []).forEach((c:any,i:number)=>{
    (c.supporting_matters || []).forEach((support:any)=>{
      if(support.personal_role)fields.push({path:`candidates/${i}`,text:support.personal_role,matterId:support.matter_id});
    });
  });
  return fields;
}
const norm=(v:any)=>String(v || '').replace(/\s+/g,' ').trim();
export function bindGeneratedFindings(defects:any[], development:any):any[] {
  const fields=generatedFields(development,true);
  return (defects || []).map(d=>{
    if(d.owner!=='rankpilot' || d.scope==='letter' || !d.artifact_quote) return d;
    const hits=fields.filter(f=>norm(f.text).includes(norm(d.artifact_quote)));
    const matching=hits.filter(f=>f.matterId===d.matter_id);
    const selected=matching.length===1?matching:hits;
    return selected.length===1?{...d,scope:'submission',field_path:selected[0].path}:d;
  });
}

/** Cheap preflight of the exact DOCX text: a finding triggers bounded repair,
 * never a rewrite or a passing verdict. The final judge still checks the pair. */
export function renderedSubmissionFindings(rendered:string, development:any, matters:any[]=[]):any[] {
  const output=norm(rendered);
  const fields=generatedFields(development);
  for(const matter of matters) {
    const index=(development?.matters || []).findIndex((m:any)=>m.matter_id===matter.id);
    const actual=String(matter.optimizedText || matter.optimized_text || '');
    if(index>=0 && actual && output.includes(norm(actual)) && !fields.some(f=>f.path===`matters/${index}/text` && f.text===actual)) fields.push({path:`matters/${index}/text`,text:actual,matterId:matter.id});
  }
  const patterns=[
    ...voiceRules.patterns.map(pattern=>new RegExp(pattern,'i')),
    /\b(?:the (?:submitted )?(?:source|record|narrative|dossier) (?:separately )?(?:lists|identifies|reports|states|frames|describes|records)|the supplied (?:status|completion)|no final outcome is stated|(?:neither recovery nor compensation|no monetary value[^.]*|no value[^.]*) is (?:stated|supplied)|it does not report recovery|the remaining procedural stage is not specified)\b/i,
    /\b(?:respectfully petitions|researcher dialogue|invite the Chambers research team to consult|welcome the opportunity to discuss)\b/i,
    /\b(?:S\.A\.\s+(?:DE|de)\s+C\.V\.|A\.C\.|LLC\.|Inc\.)\s+Is\b/,
    /[a-z]{4,}\.[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,}/,
    /[.!?]\s+the team\b/,
  ];
  return fields.filter(f=>patterns.some(p=>{
    const match=f.text.match(p);return match && output.includes(norm(match[0]));
  })).map(f=>({
    code:'EDITORIAL_STYLE',severity:'critical',owner:'rankpilot',action:'retry',retryable:true,
    scope:'submission',field_path:f.path,matter_id:f.matterId || null,source_quote:'',artifact_quote:f.text,
    message:'Corrige la redacción del campo señalado contra sus fuentes: voz de firma, gramática y puntuación. Conserva importes, roles, actuaciones y límites reales del resultado; no los elimines para ocultar el defecto.',
  }));
}
