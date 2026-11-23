// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareBatch,collectBatch,validateConfig} from './batch';
import {PLANNER_VERSIONS} from '../../src/services/planner/versions';
import {PLAN_REVIEW_VERSION} from '../../src/domain/plan-quality';
import {MockPlanner} from '../../src/services/planner/mock';
import {FOUNDATION_CASES} from './foundation';

async function sandbox(run:(dir:string)=>Promise<void>){const dir=await mkdtemp(join(tmpdir(),'lifequest-quality-'));try{await run(dir);}finally{if(!resolve(dir).startsWith(join(resolve(tmpdir()),'lifequest-quality-')))throw Error('Unexpected temp path');await rm(dir,{recursive:true,force:true});}}
const config=()=>validateConfig({provider:'compatible',model:'fixture-model',origin:'http://127.0.0.1:3000',connection:{baseUrl:'https://api.aicodemirror.ai/v1',protocol:'responses',outputMode:'json_schema'}});
describe('same advisory review in evaluation, frozen inputs and honest provenance',()=>{
 it('captures task-level warnings separately without giving an unscored proposal a content pass',async()=>sandbox(async dir=>{
  const batch=await prepareBatch('real',config());batch.slots=batch.slots.slice(0,1);
  const p=(await new MockPlanner().generate(FOUNDATION_CASES[0].input)).proposal;
  p.stages[0].tasks[0].title='检查并修复读取';p.stages[0].tasks[0].doneCriteria='保存记录，未通过项清楚标注。';
  const fetcher=vi.fn(async()=>Response.json({proposal:p,versions:PLANNER_VERSIONS,usage:{inputTokens:3,outputTokens:4,totalTokens:7}}));
  await collectBatch(dir,batch,'fixture-key',{fetcher:fetcher as typeof fetch});
  const record=JSON.parse(await readFile(`${dir}/A01.json`,'utf8'));
  expect(record.structure).toBe(true);expect(record.serverVersionVerified).toBe(true);expect(record.qualityReview.version).toBe(PLAN_REVIEW_VERSION);
  expect(record.qualityReview.issues).toContainEqual(expect.objectContaining({code:'failure-as-delivery',taskRef:'t0'}));
  expect(record.qualityReview.semanticStatus).toBe('needs-user-review');expect(record).not.toHaveProperty('contentPass');expect(record.qualityReview).not.toHaveProperty('tasks');expect(fetcher).toHaveBeenCalledTimes(1);
 }));
 it.each([null,{...PLANNER_VERSIONS,prompt:'older-prompt'}])('stops after one call when the local service version is absent or stale: %j',async versions=>sandbox(async dir=>{
  const batch=await prepareBatch('real',config());const p=(await new MockPlanner().generate(FOUNDATION_CASES[0].input)).proposal;
  const fetcher=vi.fn(async()=>Response.json({proposal:p,versions}));await collectBatch(dir,batch,'fixture-key',{fetcher:fetcher as typeof fetch});
  const record=JSON.parse(await readFile(`${dir}/A01.json`,'utf8'));expect(record.failureCode).toBe('planner-version-mismatch');expect(record.structure).toBeNull();expect(record.proposal).toBeNull();expect(fetcher).toHaveBeenCalledTimes(1);
 }));
 it('refuses a changed freeze before making any request',async()=>sandbox(async dir=>{
  const batch=await prepareBatch('real',config());batch.sourceHashes['src/domain/plan-quality.ts']='wrong-hash';const fetcher=vi.fn();
  await expect(collectBatch(dir,batch,'fixture-key',{fetcher})).rejects.toThrow('changed after freeze');expect(fetcher).not.toHaveBeenCalled();
 }));
});
