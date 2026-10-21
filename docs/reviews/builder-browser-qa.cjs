// Real Builder page in Chrome; auth/storage/create/extract explicitly mocked.
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../..');
const toolRoot='/private/tmp/rankpilot-browser-qa/node_modules';const esbuild=require(path.join(toolRoot,'esbuild'));const {chromium}=require(path.join(toolRoot,'playwright-core'));
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Builder from './src/app/builder/page';createRoot(document.getElementById('root')).render(<Builder/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfig:path.join(root,'tsconfig.json'),plugins:[{name:'qa-services',setup(build){build.onResolve({filter:/^(next\/navigation|@\/app\/actions\/submissions|@\/utils\/supabase\/client)$/},args=>({path:args.path,namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},args=>({loader:'js',contents:args.path==='next/navigation'?`export const useRouter=()=>({push:p=>window.__navigated=p});export const useSearchParams=()=>new URLSearchParams('mode=scratch');`:args.path.includes('/actions/')?`export async function createSubmission(data){window.__createCount=(window.__createCount||0)+1;window.__createdBand=data.currentBand;return {success:true,data:{id:'qa-draft'}};}`:`export const createClient=()=>({});`}));}}]});
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());await page.setContent('<html><body><div id="root"></div></body></html>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('button',{name:'Continuar a Calibración Estratégica',exact:true}).click();
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await page.getByRole('button',{name:'Continuar a Ingestión de Documentos',exact:true}).click();
  await page.locator('textarea').fill('Recipe: mix flour and bake.');
  await page.evaluate(()=>{window.fetch=async()=>({ok:false,status:422,json:async()=>({code:'NO_LEGAL_MATTERS'})});});
  await page.getByRole('button',{name:'Construir Submission con IA',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'No encontramos asuntos legales'}).waitFor();
  const notesPreserved=await page.locator('textarea').inputValue()==='Recipe: mix flour and bake.';
  await page.locator('textarea').fill('Synthetic firm represented a client in a tax appeal. The appeal remains pending.');
  await page.evaluate(()=>{window.fetch=async()=>({ok:true,status:200,json:async()=>({success:true})});});
  await page.getByRole('button',{name:'Construir Submission con IA',exact:true}).click();await page.waitForFunction(()=>window.__navigated);
  const result=await page.evaluate(()=>({createCount:window.__createCount,declaredBand:window.__createdBand,navigated:window.__navigated}));
  const report={scope:'Real Builder page, mocked services; no production calls',notesPreserved,...result,runtimeErrors:errors};fs.writeFileSync(path.join(__dirname,'builder-browser-qa.json'),JSON.stringify(report,null,2));console.log(report);
  if(!notesPreserved || result.createCount!==1 || result.declaredBand!=='' || errors.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
