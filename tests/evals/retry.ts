import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {loadBatch,prepareBatch,collectBatch,validateConfig,type Attempt,type Batch} from './batch';
export function selectRetry(batch:Batch,records:Attempt[]){
 if(records.length!==batch.slots.length||records.some(r=>r.status!=='finished'))throw new Error('Parent batch must be complete');
 if(records.some(r=>r.attemptKind!=='first'))throw new Error('Parent must contain first attempts');
 return batch.slots.filter(s=>records.find(r=>r.slotId===s.slotId)?.structure!==true);
}
export async function prepareRetry(parentDirectory:string,mode:'real'|'mock'){
 const {batch:parent,records}=await loadBatch(parentDirectory);
 if(parent.source!==mode)throw new Error('Do not mix Mock and real');
 const slots=selectRetry(parent,records);if(!slots.length)throw new Error('No failures to retry');
 const config=mode==='real'?validateConfig(parent.config):null;
 const current=await prepareBatch(mode,config,parent.datasetVersion==='lifequest-foundation-1.0.0');
 if(current.promptHash!==parent.promptHash||current.schemaHash!==parent.schemaHash||(parent.reviewHash&&current.reviewHash!==parent.reviewHash))throw new Error('Prompt/Schema changed; use a separate comparison study');
 const batch={...current,runId:randomUUID(),cases:parent.cases,slots,datasetHash:parent.datasetHash,retryOf:parent.runId,parentDirectory,attemptKind:'retry' as const};
 const retryParents=Object.fromEntries(slots.map(s=>[s.slotId,records.find(r=>r.slotId===s.slotId)!.recordId]));
 return {batch,retryParents};
}
export async function runRetry(prepared:Awaited<ReturnType<typeof prepareRetry>>,key:string,options:Parameters<typeof collectBatch>[3]={}){
 const {batch,retryParents}=prepared;const directory=`.qa/eval-retries/${batch.runId}`;
 const result=await collectBatch(directory,batch,key,{...options,retryParents});
 const rows:Attempt[]=[];for(const s of batch.slots){try{rows.push(JSON.parse(await readFile(`${directory}/${s.slotId}.json`,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 const summary={...result,retryOf:batch.retryOf,attemptKind:'retry',selectedIds:batch.slots.map(s=>s.caseId),structurePassed:rows.filter(r=>r.structure===true).length,failures:rows.filter(r=>r.structure!==true).map(r=>({caseId:r.caseId,code:r.failureCode})),humanScores:null,firstAttemptResultsUnchanged:true};
 await writeFile(`${directory}/retry-summary.json`,JSON.stringify(summary,null,2),{flag:'wx'});return summary;
}
