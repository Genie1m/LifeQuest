import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {MockPlanner} from '../../src/services/planner/mock';
import {OPENAI_MODELS} from '../../src/services/planner/catalog';
import {PROPOSAL_SCHEMA} from '../../src/domain/proposal';
import {PLANNER_PROMPT_VERSION,PROPOSAL_WIRE_SCHEMA_VERSION} from '../../src/services/planner/instructions';
import {CASES,DATASET_VERSION} from './cases';
import {structureCheck,summarize,DIMENSIONS,RUBRIC_VERSION,contentPass,type Review,type Outcome} from './evaluation';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function run(mode:string,key='',caseId?:string){
 if(!['mock','real'].includes(mode))throw new Error('Mode must be mock or real');
 if(mode==='real'&&!key)throw new Error('Credential required');
 const selected=caseId?CASES.filter(c=>c.id===caseId):CASES;if(!selected.length)throw new Error('Unknown case');
 const runId=randomUUID();const directory=`.qa/evals/${runId}`;await mkdir(directory,{recursive:true});
 const prompt=await readFile('src/services/planner/instructions.ts','utf8');
 const records=[];
 for(const c of selected){
  const startedAt=new Date().toISOString();const start=performance.now();let proposal:unknown=null;let usage:unknown=null;let failureCode:string|null=null;let generationSucceeded=false;
  try{
   if(mode==='mock'){const r=await new MockPlanner().generate(c.input);proposal=r.proposal;}
   else{const response=await fetch('http://127.0.0.1:3000/api/planner',{method:'POST',redirect:'error',signal:AbortSignal.timeout(135_000),headers:{origin:'http://127.0.0.1:3000','content-type':'application/json','x-lifequest-api-key':key},body:JSON.stringify({operation:'generate',model:OPENAI_MODELS[0].id,input:c.input})});const r=await response.json();if(!response.ok){failureCode=['authentication','model-access','quota','rate-limit','network','timeout','server','invalid-response','disabled','invalid-request','cancelled'].includes(r.code)?r.code:'unknown';}else{proposal=r.proposal;usage=r.usage??null;}}
   generationSucceeded=proposal!==null;
  }catch{failureCode='transport-or-timeout';}
  const structure=generationSucceeded?structureCheck(c,proposal):failureCode==='invalid-response'?false:null;
  // Persist allowlisted fields only, never request headers, credentials or raw errors.
 const record={recordVersion:1,runId,recordId:`${runId}:${c.id}`,caseId:c.id,datasetVersion:DATASET_VERSION,inputHash:hash(c.input),source:mode==='mock'?'mock' as const:'real' as const,provider:mode==='mock'?'mock':'openai',model:mode==='mock'?'deterministic-template':OPENAI_MODELS[0].id,promptVersion:PLANNER_PROMPT_VERSION,promptImplementationHash:hash(prompt),schemaVersion:PROPOSAL_WIRE_SCHEMA_VERSION,schemaHash:hash(PROPOSAL_SCHEMA),rubricVersion:RUBRIC_VERSION,gitCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gitDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),startedAt,attemptKind:'first' as const,parentRecordId:null,firstGenerationSucceeded:generationSucceeded,structure,review:null,issues:[],elapsedMs:Math.round(performance.now()-start),usage,costEstimate:null,manuallyEdited:false,regenerated:false,editorImported:null,failureCode,proposal};
  records.push(record);await writeFile(`${directory}/${c.id}.json`,JSON.stringify(record,null,2),{flag:'wx'});
 }
 const result={runId,source:mode,selectedCases:selected.map(c=>c.id),summary:summarize(records)};
 await writeFile(`${directory}/summary.json`,JSON.stringify(result,null,2),{flag:'wx'});
 const reviews=records.map(r=>({recordId:r.recordId,kind:'human',reviewer:'',rubricVersion:RUBRIC_VERSION,scores:Object.fromEntries(DIMENSIONS.map(k=>[k,{score:null,evidence:''}])),issues:[],editorImported:null,manuallyEdited:false,regenerated:false}));
 await writeFile(`${directory}/reviews.template.json`,JSON.stringify(reviews,null,2),{flag:'wx'});
 return {directory,...result};
}
export async function score(directory:string,reviewPath:string){
 const summary=JSON.parse(await readFile(`${directory}/summary.json`,'utf8'));
 const reviews=JSON.parse(await readFile(reviewPath,'utf8')) as (Review&{recordId:string})[];
 if(!Array.isArray(reviews)||new Set(reviews.map(r=>r.recordId)).size!==reviews.length)throw new Error('Duplicate or invalid reviews');
 const records:Array<Outcome&{recordId:string}>=[];for(const caseId of summary.selectedCases){const r=JSON.parse(await readFile(`${directory}/${caseId}.json`,'utf8'));const review=reviews.find(v=>v.recordId===r.recordId)??null;if(review)contentPass(review);records.push({...r,review});}
 if(reviews.some(r=>!records.some(v=>v.recordId===r.recordId)))throw new Error('Review references another run');
 return {source:summary.source,rubricVersion:RUBRIC_VERSION,summary:summarize(records)};
}
