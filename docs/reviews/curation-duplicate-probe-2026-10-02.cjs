// Local diagnostic, no DB writes or model calls.
require('./review-loader.cjs');
const { curateMatters } = require('../../src/lib/docx/matter-curator.ts');
const c = curateMatters([{id:'excluded-1',client:'Synthetic Excluded Client',summary:'Routine advice',isConfidential:true,isExcluded:true}], 'Tax', {});
const all = [...c.officialPubMatters,...c.officialConfMatters,...c.surplusPubMatters,...c.surplusConfMatters];
const result = {scope:'Synthetic local reproduction, not attribution of the historic DeForest mutation',input:1,output:all.length,uniqueIds:new Set(all.map(m=>m.id)).size,official:c.totalOfficialCount,reserve:c.surplusConfMatters.length,passed:all.length===1};
require('node:fs').writeFileSync(require('node:path').join(__dirname,'curation-duplicate-probe-2026-10-02.json'), JSON.stringify(result,null,2)+'\n');
console.log(result);
