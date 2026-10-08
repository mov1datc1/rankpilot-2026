/** User-confirmed filing fields; never derive headcount or leadership from a roster. */
export function normalizeFilingDetails(input:any) {
  const text=(v:unknown,max=250)=>String(v ?? '').trim().slice(0,max);
  const count=(v:unknown)=>{
    if(v==='' || v===null || v===undefined) return '';
    const n=Number(v); if(!Number.isSafeInteger(n) || n<0 || n>100000) throw new Error('Indica cantidades enteras válidas o deja el campo vacío.');
    return n;
  };
  const people=(rows:any)=>{
    if(!Array.isArray(rows) || rows.length>50) throw new Error('Revisa los contactos del formulario.');
    return rows.map(r=>({name:text(r.name),email:text(r.email),phone:text(r.phone,100)})).filter(r=>r.name || r.email || r.phone);
  };
  return {departmentName:text(input.departmentName),numPartners:count(input.numPartners),numLawyers:count(input.numLawyers),
    contacts:people(input.contacts),departmentHeads:people(input.departmentHeads),target_band:text(input.target_band,100)};
}

export function filingDetailsGaps(data:any):string[] {
  const missing:string[]=[];
  if(!(data.contacts || []).some((p:any)=>p.name && (p.email || p.phone))) missing.push('A4: contacto para entrevistas');
  if(!data.departmentName) missing.push('B1: nombre del departamento');
  if(data.numPartners===undefined || data.numPartners===null || data.numPartners==='') missing.push('B2: número de socios');
  if(data.numLawyers===undefined || data.numLawyers===null || data.numLawyers==='') missing.push('B3: número de otros abogados');
  if(!(data.departmentHeads || data.department?.department_heads || []).some((p:any)=>p.name)) missing.push('B7: responsables del departamento');
  return missing;
}
