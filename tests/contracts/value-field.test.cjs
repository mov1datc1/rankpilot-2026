require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateAndSanitizeValue}=require('../../src/lib/docx/artifact-integrity-check.ts');

test('v1.0.105: a value without currency is printed as supplied, never with a bracketed instruction',()=>{
 // Ramos Castillo 19-11: D3 printed "$3,400,000.00 [CONFIRM CURRENCY & NATURE: e.g. MXN / USD litigation exposure]".
 const out=validateAndSanitizeValue('$3,400,000.00','Example Cardboard','The company was fined after an inspection.').sanitizedValue;
 assert.equal(out,'$3,400,000.00');assert.doesNotMatch(out,/\[|CONFIRM/);
 assert.match(validateAndSanitizeValue('$3,400,000.00','Example Cardboard','Fines of MXN 3,474,240 were imposed.').sanitizedValue,/^MXN \$3,400,000\.00/);
});
