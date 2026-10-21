// Actual Studio component in Chrome, with explicit in-memory action/router mocks.
// No live account, backend, or production data. Requires esbuild/playwright-core in QA_TOOL_ROOT.
const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'../..');const toolRoot=process.env.QA_TOOL_ROOT || '/private/tmp/rankpilot-browser-qa/node_modules';
const esbuild=require(path.join(toolRoot,'esbuild'));const {chromium}=require(path.join(toolRoot,'playwright-core'));
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Studio from './src/components/SubmissionStudio';
 const matters=[{id:'m1',name:'Patent dispute',client:'Synthetic Labs',rawNotes:'The team defended the client in a patent infringement proceeding. The matter is pending.',isConfidential:true}];
 createRoot(document.getElementById('root')).render(<Studio submission={{id:'qa',practiceArea:'Intellectual Property',guideRegion:'Mexico',targetDirectory:'Chambers',matters}} initialChambersData={{firm_name:'Synthetic Legal',matters:matters.map(m=>({...m,confidentialityConfirmed:false,publish_status:'confirmation_required'})),release_verdict:{passed:false,status:'blocked'}}} auditChildren={<div>QA audit placeholder</div>}/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfig:path.join(root,'tsconfig.json'),nodePaths:[path.join(root,'node_modules')],plugins:[{name:'qa-services',setup(build){build.onResolve({filter:/^(next\/navigation|@\/app\/actions\/submissions|@\/components\/(ImportFromAssistantModal|PostIngestionWizardModal))$/},args=>({path:args.path,namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='next/navigation'?`export const useRouter=()=>({push:p=>window.__navigated=p,refresh:()=>{}});`:args.path.includes('/actions/')?`export async function updateSubmissionValidatedData(){window.__saveCalls=(window.__saveCalls||0)+1;return window.__saveOk?{success:true,revision:1}:{success:false,error:'Injected save failure'};} export async function updateDesignatedHeroMatter(){return {success:true}};`:`export default function(){return null}`,loader:'js'}));}}]});
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.abort());await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('button',{name:'Guardar Borrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'Injected save failure'}).waitFor();
 const failedSaveVisible=await page.getByText('✓ Borrador Guardado',{exact:true}).count()===0;
 await page.evaluate(()=>window.__saveOk=true);await page.getByRole('button',{name:'Guardar Borrador',exact:true}).click();await page.getByText('✓ Borrador Guardado',{exact:true}).waitFor();
 await page.getByLabel('Posición declarada',{exact:true}).fill('Band 2');
 await page.getByLabel('Edición del ranking',{exact:true}).fill('2027');
 await page.evaluate(()=>{window.fetch=async()=>({ok:false,json:async()=>({error:'Consulta oficial no disponible'})});});
 await page.getByRole('button',{name:'Guardar declaración y verificar',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Consulta oficial no disponible'}).waitFor();
 await page.evaluate(()=>{window.fetch=async()=>({ok:true,json:async()=>({success:true,chambersData:{draft_revision:2,release_verdict:{passed:false,status:'needs_review'},ranking_verification:{status:'verified_mismatch',message:'Discrepancia oficial: declarado Band 2, observado Band 3.',observed_band:'Band 3',evidence:{edition:'2027',source_url:'https://chambers.com/legal-rankings/example'}}}})});});
 await page.getByRole('button',{name:'Guardar declaración y verificar',exact:true}).click();
 await page.getByText('Discrepancia oficial: declarado Band 2, observado Band 3.',{exact:true}).waitFor();
 const rankingMismatchVisible=await page.getByLabel('Posición declarada',{exact:true}).inputValue()==='Band 2';
 await page.screenshot({path:'/private/tmp/rankpilot-studio-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/rankpilot-studio-mobile.png',fullPage:false});
 const mobile=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
 const result={scope:'Actual React Studio in Chrome; actions, router and modal children mocked. Not authenticated end-to-end.',failedSaveVisible,successfulSaveVisible:true,rankingUnavailableVisible:true,rankingMismatchVisible,runtimeErrors:errors,mobile};
 fs.writeFileSync(path.join(__dirname,'studio-browser-qa.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
 if(!failedSaveVisible || !rankingMismatchVisible || errors.length || mobile.content > mobile.viewport + 1)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
