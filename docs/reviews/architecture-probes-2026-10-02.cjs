// Offline diagnostic reproductions. This is not an acceptance suite.
// Run from the repository root: node docs/reviews/architecture-probes-2026-10-02.cjs
// No database, network, API credentials or production writes are used.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const ts = require('typescript');
const JSZip = require('jszip');
const { Packer } = require('docx');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = function (mod, filename) {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};
const { buildAuditDoc } = require(path.join(root, 'src/app/api/generate-docx/audit-builder.ts'));
const { anonymizeConfidentialClients } = require(path.join(root, 'src/lib/docx/lawyer-curator.ts'));

async function syntheticAudit(practiceArea) {
  const submission = {
    createdAt: '2026-10-02', practiceArea, guideRegion: 'Mexico', targetDirectory: 'Chambers',
    currentBand: 'Unranked',
    matters: [{ id: 'synthetic-1', client: 'Synthetic Client', isConfidential: false,
      description: 'Source only: advice on a permit.', summary: 'Source only: advice on a permit.' }],
    chambersData: { metadata: { country: 'Mexico' }, analysis: { score: 12 },
      strategic_sufficiency: { status: 'insufficient' } },
  };
  const document = buildAuditDoc('SYNTHETIC UNRELATED FIRM', practiceArea, { score: 12 }, {}, {}, submission);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  const xml = await zip.file('word/document.xml').async('string');
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

(async () => {
  const labour = await syntheticAudit('Labour & Employment');
  const energy = await syntheticAudit('Energy & Natural Resources');
  const original = 'Our office is in Hermosillo. We advised Volkswagen.';
  const scrubbed = anonymizeConfidentialClients(original, []);
  const probes = [
    { id: 'foreign_firm_facts', defect_observed: labour.includes('27 specialized labor lawyers') && labour.includes('Eduardo Garduño'),
      observation: 'An unrelated synthetic firm receives DeForest headcount and named lawyers.' },
    { id: 'inflated_score', defect_observed: labour.includes('Certified Defensibility Score: 90/100'),
      observation: 'Input score 12 becomes certified score 90/100.' },
    { id: 'false_portfolio_count', defect_observed: labour.includes('exactly 20 official matters (1 Publishable + 0 Confidential)'),
      observation: 'A one-matter portfolio is described as exactly 20 matters.' },
    { id: 'insufficiency_ignored', defect_observed: energy.includes('directory recognition in Band 4') && !energy.includes('WITHHELD'),
      observation: 'An insufficient synthetic Energy dossier receives a positive Band 4 verdict.' },
    { id: 'invented_lead_lawyer', defect_observed: energy.includes('Eduardo Garduño'),
      observation: 'A missing lead partner becomes Eduardo Garduño in an unrelated Energy matter.' },
    { id: 'unconditional_scrubbing', defect_observed: original !== scrubbed,
      input: original, confidential_entities: [], output: scrubbed },
  ];
  console.log(JSON.stringify({ baseline: 'af1368558ed38309e630b647e08dac9423848e02',
    purpose: 'Reproduce defects; exit 0 means the probe ran, not that the product passed acceptance.',
    defects_observed: probes.filter(p => p.defect_observed).length, probes }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
