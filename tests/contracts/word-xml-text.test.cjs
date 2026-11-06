require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {wordXmlText}=require('../../src/lib/docx/xml-text.ts');
test('review sees literal quotes and apostrophes as they appear in Word',()=>{
 const xml='<w:p><w:r><w:t>The employer&apos;s &quot;defence&quot; &amp; outcome &#39;A&#x27;.</w:t></w:r></w:p>';
 assert.equal(wordXmlText(xml),'The employer\'s "defence" & outcome \'A\'.\n');
});
test('entity-looking literal source text is decoded once and not rewritten',()=>{
 assert.equal(wordXmlText('<w:p><w:t>&amp;quot; &lt;100 &amp; 50&gt;10</w:t></w:p>'),'&quot; <100 & 50>10\n');
});
