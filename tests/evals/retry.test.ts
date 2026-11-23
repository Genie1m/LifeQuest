import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {prepareBatch,type Attempt} from './batch';
import {selectRetry,runRetry} from './retry';
it('selects only finished failed first attempts, and rejects incomplete parents',async()=>{
 const b=await prepareBatch('mock',null);b.slots=b.slots.slice(0,3);
 const records=b.slots.map((s,i)=>({slotId:s.slotId,status:'finished',attemptKind:'first',structure:i===0?true:null}) as Attempt);
 expect(selectRetry(b,records).map(s=>s.caseId)).toEqual(['A02','A03']);
 expect(()=>selectRetry(b,records.slice(0,2))).toThrow('complete');records[2].status='started';expect(()=>selectRetry(b,records)).toThrow('complete');
});
it('saves retry identity before and after generation and never replaces first or human files (Mock only)',async()=>{
 const b=await prepareBatch('mock',null),parentDirectory=`.qa/retry-module-test/${randomUUID()}`;
 await mkdir(parentDirectory,{recursive:true});const original='first-results-unchanged',human='human-review-unchanged';await writeFile(`${parentDirectory}/A01.json`,original);await writeFile(`${parentDirectory}/evaluation-reviewed.xlsx`,human);
 const slot=b.slots[0],parentId=`${b.runId}:${slot.slotId}`;
 const prepared={batch:{...b,runId:randomUUID(),slots:[slot],retryOf:b.runId,parentDirectory,attemptKind:'retry' as const},retryParents:{[slot.slotId]:parentId}};
 const result=await runRetry(prepared,'');expect(result.selectedIds).toEqual(['A01']);expect(result.attempted).toBe(1);expect(result.structurePassed).toBe(1);expect(result.attemptKind).toBe('retry');
 for(const suffix of ['.json','.started.json']){const record=JSON.parse(await readFile(`${result.directory}/A01${suffix}`,'utf8'));expect(record.attemptKind).toBe('retry');expect(record.parentRecordId).toBe(parentId);expect(record.regenerated).toBe(true);expect(record.source).toBe('mock');}
 expect(await readFile(`${parentDirectory}/A01.json`,'utf8')).toBe(original);expect(await readFile(`${parentDirectory}/evaluation-reviewed.xlsx`,'utf8')).toBe(human);
});
