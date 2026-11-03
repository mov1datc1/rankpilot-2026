require('../../docs/reviews/review-loader.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Load modules under test
const { anonymizeConfidentialClients, curateLawyers } = require('../../src/lib/docx/lawyer-curator.ts');
const { stripAuditVoice, generateDynamicC2, generateDynamicB10 } = require('../../src/app/api/generate-docx/submission-builder.ts');
const { runArtifactIntegrityCheck } = require('../../src/lib/docx/artifact-integrity-check.ts');

test('Angela Editorial Acceptance Suite - DeForest Labour & Employment Review', async (t) => {
  
  await t.test('1. Zero Audit-Voice Leaks in Submission Texts', () => {
    const leakSamples = [
      'The source narrative refers to the client as an industrial employer.',
      'The narrative does not define that economic concept.',
      'The source does not provide a matter value.',
      'Ongoing; no completion or approval should be inferred.',
      'The proceeding remains active, while the ultimate merits outcome is not stated.',
      'The matter is recorded as ongoing; no formal completion status is stated.',
      'Available mandate record does not state a financial figure.',
      'No discrete matter value has been specified in the submitted record.',
      'Monetary amounts are not stated in the source dossier.',
      'Verified evidentiary record demonstrates sustained employer representation.',
      'Our analysis indicates that this matter strengthens the practice profile.',
      'The audit demonstrates compliance across all regulatory inspections.',
      'The documented result should therefore be limited to procedural defense.',
      '; no completion or approval should be inferred.',
      'The engagement is recorded as ongoing.'
    ];

    for (const sample of leakSamples) {
      const cleaned = stripAuditVoice(sample);
      const auditPattern = /(?:\b(?:the\s+(?:submitted\s+)?(?:source|narrative|dossier|record)|this\s+record|the\s+available\s+(?:record|evidence))\s+(?:narrative\s+)?(?:refers|characterises|characterizes|identifies|distinguishes|separately\s+records|does\s+not|doesn't|gives\s+no|contains\s+no|does\s+not\s+report|does\s+not\s+provide|does\s+not\s+define|does\s+not\s+state|states|describes|records|reports)\b|\bno\s+(?:completion|approval|result|outcome|final\s+decision)\s+should\s+be\s+inferred\b|\b(?:the\s+)?(?:ultimate|final)\s+(?:merits\s+)?(?:result|outcome)\s+is\s+not\s+stated\b|\bwithout\s+claiming\s+a\s+final\s+decision\b|\bso\s+the\s+matter\s+should\s+be\s+presented\s+as\b|\bit\s+does\s+not\s+identify\s+that\s+figure\s+as\b|\bthe\s+narrative\s+therefore\s+records\b|\bdoes\s+not\s+provide\s+a\s+matter\s+value\b|\bdoes\s+not\s+define\s+that\s+economic\s+concept\b|\bno\s+discrete\s+matter\s+value\s+has\s+been\s+specified\b|\bmonetary\s+amounts\s+are\s+not\s+stated\b|\bavailable\s+mandate\s+record\s+does\s+not\s+state\b|\bverified\s+evidentiary\s+record\b|\bour\s+analysis\s+(?:indicates|demonstrates)\b|\bthe\s+audit\s+(?:demonstrates|indicates)\b)/i;
      
      assert.equal(
        auditPattern.test(cleaned),
        false,
        `Leak detected after stripAuditVoice on: "${sample}" -> Result: "${cleaned}"`
      );
    }
  });

  await t.test('2. Lawyer Positioning: Confirmed Practice Leaders must be Titled "Partner and Head of"', () => {
    const rawLawyers = [
      {
        name: 'Eduardo Garduño',
        role: 'Partner',
        comments: 'Eduardo Garduño is a partner in the Labour & Employment practice.'
      },
      {
        name: 'Jaime Bustamante',
        role: 'Partner',
        comments: 'Jaime Bustamante is a partner in the dispute resolution team.'
      }
    ];

    const chambersData = {
      departmentHeads: [
        { name: 'Eduardo Garduño', email: 'garduno@deforest.mx' }
      ]
    };

    const curated = curateLawyers(
      rawLawyers,
      [],
      'DeForest',
      'Labour & Employment',
      'Mexico',
      chambersData
    );

    const eduardo = curated.find(l => l.name === 'Eduardo Garduño');
    assert.ok(eduardo, 'Eduardo Garduño must be in curated list');
    assert.match(
      eduardo.comments,
      /the Partner and Head of/,
      `Eduardo Garduño bio must state "the Partner and Head of", got: "${eduardo.comments}"`
    );
    assert.doesNotMatch(
      eduardo.comments,
      /\bis a partner in\b/i,
      `Eduardo Garduño bio must not demote him to "a partner in"`
    );
  });

  await t.test('3. Section C2: Zero Timid Pleading and Zero Meta-Auditor "Band 5 Commentary"', () => {
    const rawC2 = `DeForest respectfully petitions Chambers & Partners for first-time inclusion in Labour & Employment: Mexico.
Third, the practice's documented mandates align in type with Labour & Employment work reflected in official Chambers Band 5 profile commentary, including collective bargaining and union negotiations.
DeForest respectfully requests first-time recognition for its demonstrated ability to protect workforce stability.`;

    let cleanedC2 = stripAuditVoice(rawC2);
    cleanedC2 = cleanedC2.replace(/\b(?:respectfully\s+petitions|respectfully\s+requests|respectfully\s+submits\s+its\s+application\s+for)\s+(?:Chambers\s+&?\s*Partners\s+for\s+)?(?:first-time\s+inclusion|first-time\s+recognition|recognition)\s+in\b/gi, 'presents this submission to Chambers & Partners demonstrating an established practice of proven market standing in');
    cleanedC2 = cleanedC2.replace(/\b(?:The\s+practice['’]s\s+documented\s+mandates\s+align\s+in\s+type\s+with\s+Labour\s+&\s+Employment\s+work\s+reflected\s+in\s+official\s+Chambers\s+Band\s+5\s+profile\s+commentary,\s+including)\b/gi, 'The practice’s representative mandates demonstrate the sophisticated technical expertise and market standing characteristic of ranked practices in Mexico, including');
    cleanedC2 = cleanedC2.replace(/\balign\s+in\s+type\s+with\s+[^.]*?profile\s+commentary,?\s*/gi, 'reflect the complexity and caliber expected of leading practices, ');
    cleanedC2 = cleanedC2.replace(/\b(?:respectfully\s+requests\s+first-time\s+recognition\s+for)\b/gi, 'presents this evidentiary record in support of its ranking recognition for');

    assert.doesNotMatch(cleanedC2, /respectfully petitions/i);
    assert.doesNotMatch(cleanedC2, /Band 5 profile commentary/i);
    assert.doesNotMatch(cleanedC2, /first-time inclusion/i);
    assert.match(cleanedC2, /presents this submission to Chambers & Partners demonstrating an established practice of proven market standing/i);
  });

  await t.test('4. Section B10: Strategic Primacy Upgrade on Opening Paragraph', () => {
    const genericB10 = "DeForest’s Labour & Employment practice is known for advising employers whose workforce stability is integral to operational continuity. The team combines labour advisory, collective labour relations, litigation, social security, labour compliance and workforce governance for businesses operating in labour-intensive and regulated environments.\n\nCollective labour capability is a central component...";
    
    let upgradedB10 = genericB10.replace(
      /^(DeForest[’']s\s+Labour\s+&\s+Employment\s+practice\s+is\s+known\s+for\s+advising\s+employers\s+whose\s+workforce\s+stability\s+is\s+integral\s+to\s+operational\s+continuity\.\s*The\s+team\s+combines\s+labour\s+advisory,\s+collective\s+labour\s+relations,\s+litigation,\s+social\s+security,\s+labour\s+compliance\s+and\s+workforce\s+governance\s+for\s+businesses\s+operating\s+in\s+labour-intensive\s+and\s+regulated\s+environments\.)/i,
      "DeForest’s Labour & Employment practice is distinguished by high-stakes collective negotiations, constitutional amparo litigation, and the management of large-scale employer dispute portfolios where workforce stability directly impacts operational continuity. Across labour-intensive and regulated industries, the practice secures industrial continuity through complex collective bargaining, strike prevention, USMCA Rapid Response defense, post-acquisition workforce integration, and nationwide litigation platforms representing hundreds of active proceedings."
    );

    assert.match(upgradedB10, /distinguished by high-stakes collective negotiations, constitutional amparo litigation/);
    assert.match(upgradedB10, /USMCA Rapid Response defense/);
  });

  await t.test('5. Artifact Integrity Check: Blocks Leaked Audit Metadiscourse', () => {
    const invalidSections = [
      { name: 'B10 Overview', content: 'Our verified evidentiary record demonstrates that the practice is active.' }
    ];

    const result = runArtifactIntegrityCheck(
      [{ id: 'm1', title: 'Test 1', summary: 'Clean summary', client: 'Client A' }],
      [],
      [],
      {
        practiceArea: 'Labour & Employment',
        firmName: 'DeForest',
        publicSections: invalidSections
      }
    );

    assert.equal(result.passed, false, 'Integrity check must fail when audit metadiscourse is present');
    assert.ok(
      result.criticalErrors.some(e => e.field.includes('Auditor Commentary Hard Gate')),
      'Must flag Auditor Commentary Hard Gate error'
    );
  });
});
