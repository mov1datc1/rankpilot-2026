require('../../docs/reviews/review-loader.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {observeEditorialJob}=require('../../src/lib/editorial/job-observer.ts');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('a hung request times out and polling obtains completion without a generation request',async()=>{
 let calls=0,errors=0,lateResolve,signal;const applied=[];
 const observer=observeEditorialJob({timeoutMs:15,retryMs:5,idleMs:10000,
 read:s=>{calls++;if(calls===1){signal=s;return new Promise(r=>lateResolve=r);}return Promise.resolve({job:{status:'completed'},files:2});},
 apply:data=>applied.push(data),onError:()=>errors++});
 try{for(let i=0;i<20 && !applied.length;i++)await sleep(10);
 assert.equal(errors,1);assert.equal(signal.aborted,true);assert.equal(calls,2);assert.equal(applied[0].job.status,'completed');
 lateResolve({job:{status:'failed'}});await sleep(5);assert.equal(applied.length,1);
 }finally{observer.dispose();}
});
test('focus/online refresh is single flight; disposal cannot apply a late response',async()=>{
 let calls=0,resolve;const applied=[];
 const observer=observeEditorialJob({read:()=>{calls++;return new Promise(r=>resolve=r);},apply:x=>applied.push(x),onError:()=>{}});
 observer.refresh();observer.refresh();assert.equal(calls,1);observer.dispose();resolve({job:{status:'completed'}});
 await sleep(1);assert.deepEqual(applied,[]);
});
test('terminal failures keep polling and can transition to completed',async()=>{
 let calls=0;const states=[];
 const observer=observeEditorialJob({idleMs:5,read:async()=>({job:{status:++calls===1?'failed':'completed'}}),apply:d=>states.push(d.job.status),onError:()=>{}});
 try{for(let i=0;i<20 && states.length<2;i++)await sleep(5);assert.deepEqual(states.slice(0,2),['failed','completed']);}finally{observer.dispose();}
});
