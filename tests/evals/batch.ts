import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {FOUNDATION_CASES,FOUNDATION_SLOTS,FOUNDATION_VERSION} from './foundation';
import {SCENARIOS60_CASES,SCENARIOS60_SLOTS,SCENARIOS60_VERSION,SCENARIOS60_PROVENANCE} from './scenarios60';
import {DIMENSIONS,RUBRIC_VERSION,contentPass,structureCheck,type Review} from './evaluation';
import {PLANNER_PROMPT_VERSION,PROPOSAL_WIRE_SCHEMA_VERSION} from '../../src/services/planner/instructions';
import {PROPOSAL_SCHEMA} from '../../src/domain/proposal';
import {MockPlanner} from '../../src/services/planner/mock';
import {normalizeBase,type ConnectionOptions} from '../../src/services/planner/connection';
import {parsePlanningInput} from '../../src/services/planner/server';
import {proposalReview,PLAN_REVIEW_VERSION} from '../../src/domain/plan-quality';
import {parseProposal} from '../../src/domain/proposal';
import {PLANNER_VERSIONS} from '../../src/services/planner/versions';
import {plannerFingerprint,assertPlannerFingerprint} from './planner-fingerprint';

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export interface BatchConfig {provider:'openai'|'compatible'|'qwen';model:string;origin:string;connection?:ConnectionOptions}
export function validateConfig(raw:unknown):BatchConfig {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid configuration');
 const c=raw as BatchConfig;
 if(Object.keys(c).some(k=>!['provider','model','origin','connection'].includes(k))||!['openai','compatible','qwen'].includes(c.provider)||typeof c.model!=='string'||!c.model.trim()||c.model.length>100||!/^[a-zA-Z0-9._:/-]+$/.test(c.model))throw new Error('Invalid provider/model configuration');
 const u=new URL(c.origin);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.origin!==c.origin)throw new Error('Loopback origin required');
 if(c.provider==='openai'&&c.connection!==undefined)throw new Error('Official provider cannot override endpoint');
 if(c.provider!=='openai'){
  const v=c.connection;
  if(!v||Object.keys(v).some(k=>!['baseUrl','protocol','outputMode','disableThinking'].includes(k))||!['responses','chat'].includes(v.protocol)||!['json_schema','json_object'].includes(v.outputMode)||(v.disableThinking!==undefined&&typeof v.disableThinking!=='boolean')||normalizeBase(v.baseUrl)!==v.baseUrl)throw new Error('Invalid connection');
 }
 return structuredClone(c);
}
export async function prepareBatch(source:'pending'|'mock'|'real',config:BatchConfig|null,legacy=false){
 if(source==='real'&&!config)throw new Error('Configuration required');
 const prompt=await readFile('src/services/planner/instructions.ts','utf8');
 const review=await readFile('src/domain/plan-quality.ts','utf8');
 const rubric=(await readFile('docs/AI_EVALUATION.md','utf8')).split('| 维度 |')[1]?.split('时间项不能')[0];
 if(!rubric)throw new Error('Rubric table not found');
 const cases=legacy?FOUNDATION_CASES:SCENARIOS60_CASES,slots=legacy?FOUNDATION_SLOTS:SCENARIOS60_SLOTS;
 return {batchVersion:1,runId:randomUUID(),source,createdAt:new Date().toISOString(),datasetVersion:legacy?FOUNDATION_VERSION:SCENARIOS60_VERSION,datasetProvenance:legacy?'历史15组输入×4次，合成数据；未额外调用LLM API。':SCENARIOS60_PROVENANCE,datasetHash:hash(cases),sourceHashes:await plannerFingerprint(),promptVersion:PLANNER_PROMPT_VERSION,promptHash:hash(prompt),schemaVersion:PROPOSAL_WIRE_SCHEMA_VERSION,schemaHash:hash(PROPOSAL_SCHEMA),reviewVersion:PLAN_REVIEW_VERSION,reviewHash:hash(review),rubricVersion:RUBRIC_VERSION,rubricRows:rubric.trim().split(/\r?\n/).filter(s=>s.startsWith('|')&&!s.startsWith('| ---')).map(s=>s.split('|').slice(1,-1).map(x=>x.trim())),config,gitCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gitDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),cases,slots};
}
export type Batch=Awaited<ReturnType<typeof prepareBatch>>;
export interface Attempt {recordVersion:1;recordId:string;slotId:string;caseId:string;round:number;source:'mock'|'real';attemptKind:'first'|'retry';parentRecordId?:string;startedAt:string;inputHash:string;status:'started'|'finished';generationSucceeded:boolean|null;structure:boolean|null;elapsedMs:number|null;usage:unknown;failureCode:string|null;requestId:string|null;upstreamStatus:number|null;proposal:unknown;costEstimate:null;editorImported:null;manuallyEdited:false;regenerated:boolean;qualityReview?:Omit<ReturnType<typeof proposalReview>,'tasks'>;serverVersionVerified?:boolean}
const codes=['authentication','model-access','quota','rate-limit','network','timeout','server','invalid-response','disabled','invalid-request','cancelled'];
export async function collectBatch(directory:string,batch:Batch,key:string,options:{fetcher?:typeof fetch;pause?:(ms:number)=>Promise<void>;onProgress?:(done:number)=>void;retryParents?:Record<string,string>}={}){
 if(!['mock','real'].includes(batch.source))throw new Error('Cannot execute a template');
 const config=batch.config?validateConfig(batch.config):null;
 if(batch.source==='real'&&(!config||!key||key.length>512||!/^[\x21-\x7e]+$/.test(key)))throw new Error('Missing credential');
 if(batch.sourceHashes)await assertPlannerFingerprint(batch.sourceHashes);
 await mkdir(directory,{recursive:true});
 await writeFile(`${directory}/batch.json`,JSON.stringify(batch,null,2),{flag:'wx'});
 const records:Attempt[]=[];let lastStart=0;
 for(const slot of batch.slots){
  if(batch.sourceHashes)await assertPlannerFingerprint(batch.sourceHashes);
  const c=batch.cases.find(c=>c.id===slot.caseId)!;parsePlanningInput(c.input);
  // At most 18 new requests/minute, sequential, no connection test or retries.
  const wait=3400-(Date.now()-lastStart);if(batch.source==='real'&&wait>0)await (options.pause??(ms=>new Promise(r=>setTimeout(r,ms))))(wait);
  const record:Attempt={recordVersion:1,recordId:`${batch.runId}:${slot.slotId}`,slotId:slot.slotId,caseId:c.id,round:slot.round,source:batch.source as 'mock'|'real',attemptKind:'first',startedAt:new Date().toISOString(),inputHash:hash(c.input),status:'started',generationSucceeded:null,structure:null,elapsedMs:null,usage:null,failureCode:null,requestId:null,upstreamStatus:null,proposal:null,costEstimate:null,editorImported:null,manuallyEdited:false,regenerated:false};
  if(options.retryParents){const parent=options.retryParents[slot.slotId];if(!parent)throw new Error('Missing retry parent');record.attemptKind='retry';record.parentRecordId=parent;record.regenerated=true;}
  // A durable intent BEFORE a request; an interrupted slot stays unknown, never retried.
  await writeFile(`${directory}/${slot.slotId}.started.json`,JSON.stringify(record,null,2),{flag:'wx'});
  const start=performance.now();lastStart=Date.now();
  try{
   if(batch.source==='mock'){record.proposal=(await new MockPlanner().generate(c.input)).proposal;}
   else{
    const r=await (options.fetcher??fetch)(`${config!.origin}/api/planner`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(135000),headers:{origin:config!.origin,'content-type':'application/json','x-lifequest-api-key':key},body:JSON.stringify({operation:'generate',provider:config!.provider,model:config!.model,...(config!.connection?{connection:config!.connection}:{}),input:c.input})});
    const value=await r.json();
    if(r.ok){record.proposal=value.proposal??null;const u=value.usage;record.usage=u&&typeof u==='object'?Object.fromEntries(Object.entries(u).filter(([k,v])=>['inputTokens','outputTokens','totalTokens','cachedInputTokens','reasoningTokens'].includes(k)&&typeof v==='number'&&Number.isFinite(v)&&v>=0)):null;
     if(batch.reviewVersion){record.serverVersionVerified=Object.entries(PLANNER_VERSIONS).every(([k,v])=>value.versions?.[k]===v);if(!record.serverVersionVerified){record.proposal=null;record.failureCode='planner-version-mismatch';}}
    }
    else{record.failureCode=codes.includes(value.code)?value.code:'unknown';record.requestId=typeof value.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(value.requestId)?value.requestId:null;record.upstreamStatus=Number.isInteger(value.upstreamStatus)&&value.upstreamStatus>=100&&value.upstreamStatus<=599?value.upstreamStatus:null;}
   }
   record.generationSucceeded=record.proposal!==null;
   record.structure=record.generationSucceeded?structureCheck(c,record.proposal):record.failureCode==='invalid-response'?false:null;
   // Only strictly validated proposals leave memory. Invalid upstream text may contain secrets.
   if(record.structure!==true){record.proposal=null;if(record.generationSucceeded)record.failureCode='invalid-response';}
   if(record.proposal!==null&&JSON.stringify(record.proposal).includes(key)&&key){record.proposal=null;record.structure=false;record.failureCode='invalid-response';}
   if(record.structure===true){const {tasks: _tasks,...quality}=proposalReview(parseProposal(record.proposal),c.input.weeklyHours,false,c.input);void _tasks;record.qualityReview=quality;}
  }catch{record.failureCode='transport-or-timeout';record.generationSucceeded=false;}
  record.status='finished';record.elapsedMs=Math.round(performance.now()-start);
  await writeFile(`${directory}/${slot.slotId}.json`,JSON.stringify(record,null,2),{flag:'wx'});records.push(record);options.onProgress?.(records.length);
  // Stop on a configuration/access failure, keep already attempted slots, do not burn 60 calls.
  if(['disabled','authentication','model-access','invalid-request','planner-version-mismatch'].includes(record.failureCode??''))break;
 }
 return {directory,attempted:records.length,planned:batch.slots.length,source:batch.source};
}
export async function loadBatch(directory:string){
 const batch=JSON.parse(await readFile(`${directory}/batch.json`,'utf8')) as Batch;
 const expected=batch.datasetVersion===FOUNDATION_VERSION?{cases:FOUNDATION_CASES,slots:FOUNDATION_SLOTS}:batch.datasetVersion===SCENARIOS60_VERSION?{cases:SCENARIOS60_CASES,slots:SCENARIOS60_SLOTS}:null;
 if(!expected||batch.batchVersion!==1||batch.datasetHash!==hash(batch.cases)||batch.datasetHash!==hash(expected.cases)||batch.slots.length!==60||JSON.stringify(batch.slots)!==JSON.stringify(expected.slots))throw new Error('Batch integrity mismatch');
 const records:Attempt[]=[];
 for(const slot of batch.slots){
  let r:Attempt|null=null;
  for(const suffix of ['.json','.started.json']){try{r=JSON.parse(await readFile(`${directory}/${slot.slotId}${suffix}`,'utf8'));break;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  if(r){if(r.recordId!==`${batch.runId}:${slot.slotId}`||r.caseId!==slot.caseId||r.source!==batch.source||r.attemptKind!=='first'||r.inputHash!==hash(batch.cases.find(c=>c.id===slot.caseId)!.input))throw new Error('Record integrity mismatch');records.push(r);}
 }
 return {batch,records};
}
export function judgeAttempt(record:Attempt|null,review:Review|null):'待生成'|'结果未确认'|'待评分'|'合格'|'不合格'{
 if(!record)return '待生成';if(record.status!=='finished')return '结果未确认';
 if(record.structure!==true)return '不合格';
 const pass=contentPass(review);return pass===null?'待评分':pass?'合格':'不合格';
}
export function summarizeBatch(batch:Batch,records:Attempt[],reviews:Map<string,Review>=new Map()){
 const states=batch.slots.map(s=>{const r=records.find(r=>r.slotId===s.slotId)??null;return judgeAttempt(r,r?reviews.get(r.recordId)??null:null);});
 const qualified=states.filter(s=>s==='合格').length;const judged=states.filter(s=>['合格','不合格'].includes(s)).length;
 const observed=records.filter(r=>r.structure!==null).length;const passed=records.filter(r=>r.structure===true).length;
 return {source:batch.source,planned:60,attempted:records.length,structureObserved:observed,structureUnobserved:records.length-observed,structurePassed:passed,structureRate:observed?passed/observed:null,requestStructureRate:records.length?passed/records.length:null,judged,qualified,qualificationRate:records.length&&judged===records.length?qualified/records.length:null,full60Rate:judged===60?qualified/60:null};
}
export {DIMENSIONS};
