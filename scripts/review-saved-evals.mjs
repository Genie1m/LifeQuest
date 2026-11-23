import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const [first,retry]=process.argv.slice(2);if(!first)throw new Error('Usage: node scripts/review-saved-evals.mjs <first-run-directory> [retry-directory]');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const batch=await json(`${first}/batch.json`),rb=retry?await json(`${retry}/batch.json`):null;
if(!['mock','real'].includes(batch.source)||!Array.isArray(batch.cases)||!Array.isArray(batch.slots))throw Error('Invalid saved batch');
if(rb&&(rb.retryOf!==batch.runId||rb.source!==batch.source||rb.promptHash!==batch.promptHash||rb.schemaHash!==batch.schemaHash||rb.datasetHash!==batch.datasetHash))throw Error('Retry differs from its original study');
let server;
try{
 server=await createServer({root,configFile:false,resolve:{alias:{'@':`${root}src`}},server:{middlewareMode:true},appType:'custom'});
 const {proposalReview,PLAN_REVIEW_VERSION}=await server.ssrLoadModule('/src/domain/plan-quality.ts');
 const {structureCheck}=await server.ssrLoadModule('/tests/evals/evaluation.ts');
 const records=[];
 for(const slot of batch.slots){
  const c=batch.cases.find(c=>c.id===slot.caseId);if(!c)throw Error('Missing case');
  const original=await json(`${first}/${slot.slotId}.json`);let chosen=original;
  if(original.structure!==true&&rb?.slots.some(s=>s.slotId===slot.slotId))chosen=await json(`${retry}/${slot.slotId}.json`);
  const inputHash=createHash('sha256').update(JSON.stringify(c.input)).digest('hex');
  if(chosen.inputHash!==inputHash||chosen.caseId!==c.id||chosen.source!==batch.source||(chosen!==original&&(chosen.parentRecordId!==original.recordId||chosen.attemptKind!=='retry')))throw Error('Record provenance mismatch');
  if(chosen.structure!==true){records.push({caseId:c.id,recordId:chosen.recordId,ruleReview:null,reason:'No structurally valid proposal'});continue;}
  if(!structureCheck(c,chosen.proposal))throw Error('Saved proposal no longer imports under the current domain rules');
  const {tasks:_tasks,...ruleReview}=proposalReview(chosen.proposal,c.input.weeklyHours,false,c.input);void _tasks;
  records.push({caseId:c.id,recordId:chosen.recordId,attemptKind:chosen.attemptKind,ruleReview});
 }
 const counts={};for(const r of records)for(const code of new Set(r.ruleReview?.issues.map(i=>i.code)??[]))counts[code]=(counts[code]??0)+1;
 const output=`.qa/quality-analysis/${randomUUID()}`;await mkdir(output,{recursive:true});
 const report={kind:'rule-audit-of-saved-outputs',source:batch.source,originalRun:batch.runId,originalPrompt:batch.promptVersion,retryRun:rb?.runId??null,reviewVersion:PLAN_REVIEW_VERSION,newModelGenerations:0,contentScores:null,contentQualificationRate:null,reviewed:records.filter(r=>r.ruleReview).length,casesWithAdvisories:records.filter(r=>r.ruleReview?.issues.length).length,advisoryCasesByCode:counts,records};
 await writeFile(`${output}/rule-review.json`,JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({output:`${output}/rule-review.json`,kind:report.kind,originalPrompt:report.originalPrompt,reviewVersion:report.reviewVersion,reviewed:report.reviewed,newModelGenerations:0,contentQualificationRate:null,advisoryCasesByCode:counts},null,2));
}finally{await server?.close();}
