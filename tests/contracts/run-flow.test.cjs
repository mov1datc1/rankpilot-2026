require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const flow=require('../../src/lib/admin/run-flow.ts');

// Synthetic job: the shape of a real ledger (register, selection with a rejection,
// construction, a code gate, field review, repair, Audit and two judge verdicts).
const usage=(i,o,cached=0)=>({input_tokens:i,output_tokens:o,input_token_details:{cache_read:cached},output_token_details:{reasoning:Math.round(o/3)}});
const rule={source:'Editorial_Methodology.txt',tier:'methodology',score:90};
const call=(role,extra={})=>({role,model:'gpt-5.6-terra',usage:usage(10000,1000),seconds:20,response_status:'completed',...extra});
const job={id:'00000000-0000-4000-8000-000000000001',submissionId:'s1',status:'completed',stage:'artifact',
  tasks:['selection','development','audit','artifact','development','audit','artifact'],createdAt:'2026-11-27T10:00:00Z',updatedAt:'2026-11-27T10:20:00Z',
  ledger:[
    {stage:'register',trace:call('case_register')},
    {stage:'selection',cursor:0,trace:{role:'selection_with_review',calls:[call('strategist',{retrieved_rules:[rule]}),call('selection_reviewer'),call('strategist'),call('selection_reviewer')]}},
    {stage:'development',cursor:1,trace:call('development',{construction_unit:{kind:'plan'},retrieved_rules:[rule]})},
    {stage:'development',cursor:1,trace:{role:'selection_with_review',calls:[call('development',{construction_unit:{kind:'matters'},parallel_batch:2}),call('development',{construction_unit:{kind:'bio'},parallel_batch:2})]}},
    {stage:'development',cursor:1,trace:call('development',{construction_unit:{kind:'institutional'}}),issue:{code:'DEVELOPMENT_REJECTED',rule_id:'RP13',message:'B9 role of the head is missing.'}},
    {stage:'development',cursor:1,trace:call('repair')},
    {stage:'development',cursor:1,trace:call('field_reviewer',{reviewed_fields:[{field:'b10'},{field:'c2'}]})},
    {stage:'audit',cursor:2,trace:{role:'selection_with_review',calls:[call('writer'),call('field_reviewer')]}},
    {stage:'artifact',cursor:3,trace:call('editor',{model:'gpt-5.6-sol'}),supervision:{action:'repair',reason:'source_bound_field_recovery',findings:['a','b'],repair_fields:['c2']}},
    {stage:'development',cursor:4,trace:call('repair')},
    {stage:'audit',cursor:5,trace:call('writer')},
    {stage:'artifact',cursor:6,trace:call('editor',{model:'gpt-5.6-sol'}),supervision:{action:'deliver',reason:'source_confirmation_required'}},
  ]};
const data={firm_name:'Example Firm',release_verdict:{errors:['A column claim is unverified.']},approved_artifact:true,
  review_checkpoint:{state:{
    node_events:[{node:'register',status:'completed'},{node:'strategy',status:'completed'},{node:'selection_review',status:'rejected'},{node:'strategy',status:'completed'},{node:'selection_review',status:'completed'},
      ...Array.from({length:3},()=>[{node:'case',status:'completed'},{node:'development',status:'rejected'},{node:'release',status:'completed'}]).flat(),{node:'writer',status:'completed'}],
    field_review_receipts:[{field:'c2',checks:[{status:'met'},{status:'unmet',obligation_id:'c2:coverage',reason:'C2 repeats B10.'}]}],
    repair_report:{unresolved:['b10: no change authorised.']},
    development_build_report:{unit_corrections:{'{"kind": "institutional"}':1},rejected_responses:[{unit:{kind:'institutional'},error:'C2 opens by presenting the practice.'}]},
    selection_failure_history:[['m1'],[]],
  }}};

test('every paid call lands in its block, and the costs follow list prices',()=>{
  const f=flow.buildRunFlow(job,data);
  const by=Object.fromEntries(f.blocks.map(b=>[b.id,b]));
  assert.equal(f.totals.calls,17);
  assert.equal(by.strategist.calls,2);assert.equal(by.selection_reviewer.calls,2);
  assert.equal(by.plan.calls,1);assert.equal(by.matters.calls,1);assert.equal(by.bio.calls,1);assert.equal(by.institutional.calls,1);
  assert.equal(by.field_reviewer.calls,1);assert.equal(by.audit_reviewer.calls,1);assert.equal(by.judge.calls,2);assert.equal(by.repair.calls,2);
  assert.equal(flow.callUsd(call('x')),(10000*2+1000*12)/1e6);
  assert.equal(flow.callUsd({model:'gpt-5.6-sol',usage:usage(10000,1000,5000)}),(5000*4+5000*4*0.1+1000*20)/1e6);
  assert.equal(f.totals.rounds,2);
});

test('code gates, judge verdicts and correction loops are visible blocks and links',()=>{
  const f=flow.buildRunFlow(job,data);
  const by=Object.fromEntries(f.blocks.map(b=>[b.id,b]));
  assert.equal(f.totals.gateRejections,1);assert.equal(by.gate.rejections,1);assert.equal(by.institutional.rejections,1);
  assert.ok(by.gate.exited.some(i=>/RP13/.test(i.label)));
  assert.equal(f.totals.judgeVerdicts,2);
  assert.ok(by.judge.exited.some(i=>/Devuelve a reparar/.test(i.label)&&/c2/.test(i.detail)));
  const link=(a,b)=>f.links.find(l=>l.from===a&&l.to===b);
  assert.equal(link('selection_reviewer','strategist').kind,'loop');
  assert.equal(link('judge','repair').kind,'loop');
  assert.equal(link('institutional','gate').kind,'forward');
  assert.equal(link('judge','delivery').kind,'forward');
  assert.ok(by.repair.entered.some(i=>/Rechazo en código/.test(i.label)));
  assert.ok(by.repair.entered.some(i=>/Juez, ronda 1/.test(i.label)));
});

test('RAG is its own block, with the rules each block retrieved',()=>{
  const f=flow.buildRunFlow(job,data);
  const rag=f.blocks.find(b=>b.id==='rag');
  assert.equal(rag.calls,2);
  assert.deepEqual(f.links.filter(l=>l.kind==='rag').map(l=>l.to).sort(),['plan','strategist']);
  assert.equal(f.blocks.find(b=>b.id==='plan').rag[0].source,'Editorial_Methodology.txt');
});

test('final reports are attached to the block that produced them',()=>{
  const f=flow.buildRunFlow(job,data);
  const by=Object.fromEntries(f.blocks.map(b=>[b.id,b]));
  assert.ok(by.field_reviewer.exited.some(i=>/1 cumplidas · 1 no cumplidas/.test(i.detail||'')));
  assert.ok(by.field_reviewer.entered.some(i=>i.label==='Campos enviados a revisión'&&/b10 · c2/.test(i.detail)));
  assert.ok(by.repair.exited.some(i=>/Sin resolver/.test(i.label)));
  assert.ok(by.institutional.exited.some(i=>/Autocorrección/.test(i.label)));
  assert.ok(by.judge.exited.some(i=>/Defecto del veredicto final/.test(i.label)));
  assert.ok(by.selection_reviewer.exited.some(i=>i.label==='Intento 1'&&i.tone==='bad'));
  assert.ok(by.delivery.exited.some(i=>/approved_artifact/.test(i.detail||'')));
  assert.ok(f.findings.length>=4);
  assert.ok(f.findings.every(g=>g.items.every(i=>!/^(Hacia|Desde|Tokens) /.test(i.label))));
});

test('the engine route folds repeated cycles',()=>{
  const f=flow.buildRunFlow(job,data);
  const cycle=f.engine.sequence.find(s=>s.repeat===3);
  assert.equal(cycle.node,'case → development → release');
  assert.equal(f.engine.nodes.find(n=>n.id==='development').statuses.rejected,3);
  assert.deepEqual(flow.foldCycles(['a','b','a','b','c']),[{items:['a','b'],repeat:2},{items:['c'],repeat:1}]);
});

test('an empty or legacy job never breaks the page',()=>{
  const f=flow.buildRunFlow({id:'x',ledger:[{stage:'selection'}],status:'running'},{});
  assert.equal(f.totals.calls,0);
  assert.ok(Array.isArray(f.blocks));
});

test('only administrators reach the flow, and the case documents are never loaded',()=>{
  const root=path.join(__dirname,'../..');
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  for(const page of ['src/app/dashboard/admin/flow/page.tsx','src/app/dashboard/admin/flow/[jobId]/page.tsx']){
    const source=read(page);
    assert.match(source,/const admin = await flowAdmin\(\);\s*if \(!admin\) redirect\('\/builder'\);/);
  }
  const data=read('src/lib/admin/run-flow-data.ts');
  assert.match(data,/requireAdmin/);
  assert.match(data,/listFlowRuns\(limit = 80\): Promise<FlowRunRow\[\]> \{\n  if \(!\(await flowAdmin\(\)\)\) return \[\];/);
  assert.match(data,/loadRunFlow\(jobId: string\): Promise<RunFlow \| null> \{\n  if \(!\(await flowAdmin\(\)\)\) return null;/);
  assert.match(data,/'approved_artifact', \(s\."chambersData"->'approved_artifact'\) IS NOT NULL/);
  assert.doesNotMatch(data,/'draft_artifact', s\."chambersData"->'draft_artifact'[,)]/);
  assert.match(read('src/lib/auth-guards.ts'),/dbUser\.role !== 'ADMIN' && dbUser\.role !== 'SUPERADMIN'/);
  assert.match(read('src/components/AdminTabs.tsx'),/'Flujo del grafo', href: '\/dashboard\/admin\/flow'/);
});
