import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FOUNDATION_CASES,FOUNDATION_SLOTS} from './foundation';
import {SCENARIOS60_CASES,SCENARIOS60_SLOTS,SCENARIOS60_VERSION} from './scenarios60';
import {collectBatch,loadBatch,prepareBatch,judgeAttempt,summarizeBatch,validateConfig,type Attempt} from './batch';
import {DIMENSIONS,RUBRIC_VERSION,type Review} from './evaluation';
import {MockPlanner} from '../../src/services/planner/mock';
import {parsePlanningInput} from '../../src/services/planner/server';
import {PLANNER_VERSIONS} from '../../src/services/planner/versions';
const human=(score=4):Review=>({kind:'human',reviewer:'synthetic-test',rubricVersion:RUBRIC_VERSION,scores:Object.fromEntries(DIMENSIONS.map(k=>[k,{score,evidence:'Synthetic assertion only'}])) as Review['scores']});
describe('60-attempt preregistered evaluation',()=>{
 it('fixes 5 scenarios x 3 levels x 4 first attempts, isolating baseline within scenario',()=>{
  expect(FOUNDATION_CASES).toHaveLength(15);expect(FOUNDATION_SLOTS).toHaveLength(60);expect(new Set(FOUNDATION_SLOTS.map(s=>s.slotId)).size).toBe(60);
  for(const c of FOUNDATION_CASES){expect(parsePlanningInput(c.input)).toEqual(c.input);expect(FOUNDATION_SLOTS.filter(s=>s.caseId===c.id)).toHaveLength(4);const peers=FOUNDATION_CASES.filter(p=>p.scenario===c.scenario);expect(new Set(peers.map(p=>JSON.stringify({...p.input,baseline:''}))).size).toBe(1);}
 });
 it('uses 60 distinct v2 inputs, 12 per scenario and 4 per foundation level; all are valid planning requests',async()=>{
  expect(SCENARIOS60_CASES).toHaveLength(60);expect(new Set(SCENARIOS60_CASES.map(c=>JSON.stringify(c.input))).size).toBe(60);
  for(const category of new Set(SCENARIOS60_CASES.map(c=>c.scenario))){const group=SCENARIOS60_CASES.filter(c=>c.scenario===category);expect(group).toHaveLength(12);for(const level of ['初学','基础','进阶'])expect(group.filter(c=>c.level===level)).toHaveLength(4);}
  expect(SCENARIOS60_SLOTS.every(s=>s.slotId===s.caseId&&s.round===1)).toBe(true);
  for(const c of SCENARIOS60_CASES)expect(parsePlanningInput(c.input)).toEqual(c.input);
  const b=await prepareBatch('pending',null);expect(b.datasetVersion).toBe(SCENARIOS60_VERSION);expect(b.cases).toHaveLength(60);expect(b.datasetProvenance).toContain('未额外调用LLM API');
 });
 it('accepts only nonsecret config and exact local origins',()=>{
  const c={provider:'compatible',model:'gpt-6.1-sol',origin:'http://127.0.0.1:3000',connection:{baseUrl:'https://api.aicodemirror.ai/v1',protocol:'responses',outputMode:'json_schema'}};
  expect(validateConfig(c)).toEqual(c);for(const patch of [{apiKey:'secret'},{origin:'https://evil.example'},{origin:'http://127.0.0.1:3000/?key=x'},{model:'secret key'}])expect(()=>validateConfig({...c,...patch})).toThrow();
 });
 it('keeps pending and unknown separate; never gives unscored real results a pass',async()=>{
  const b=await prepareBatch('pending',null);expect(summarizeBatch(b,[]).full60Rate).toBeNull();expect(judgeAttempt(null,null)).toBe('待生成');
  const r={status:'started'} as Attempt;expect(judgeAttempt(r,null)).toBe('结果未确认');expect(judgeAttempt({...r,status:'finished',structure:true},null)).toBe('待评分');
 });
 it('records all 60 Mock first attempts and refuses overwrite (not real model evidence)',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lifequest-eval-'));try{const b=await prepareBatch('mock',null);await collectBatch(dir,b,'');const data=await loadBatch(dir);expect(data.records).toHaveLength(60);expect(data.records.every(r=>r.structure===true&&r.source==='mock')).toBe(true);await expect(collectBatch(dir,b,'')).rejects.toThrow();expect(summarizeBatch(b,data.records).qualificationRate).toBeNull();
   const reviews=new Map(data.records.map((r,i)=>[r.recordId,human(i<53?4:2)]));const summary=summarizeBatch(b,data.records,reviews);expect(summary.full60Rate).toBeCloseTo(53/60);expect(summary.source).toBe('mock');
   reviews.delete(data.records[0].recordId);expect(summarizeBatch(b,data.records,reviews).full60Rate).toBeNull();
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('still reads frozen legacy 15-input batches without treating them as 60 independent cases',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lifequest-eval-'));try{const b=await prepareBatch('mock',null,true);await collectBatch(dir,b,'');const data=await loadBatch(dir);expect(data.batch.cases).toHaveLength(15);expect(data.records).toHaveLength(60);expect(data.batch.datasetVersion).toBe('lifequest-foundation-1.0.0');}finally{await rm(dir,{recursive:true,force:true});}
 });
 it('saves only allowlisted errors and stops on access failure, never retries',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lifequest-eval-'));try{const c=validateConfig({provider:'openai',model:'test-model',origin:'http://127.0.0.1:3000'});const b=await prepareBatch('real',c);const fetcher=vi.fn(async()=>Response.json({code:'authentication',message:'SECRET',authorization:'SECRET'},{status:502}));await collectBatch(dir,b,'SECRET',{fetcher:fetcher as typeof fetch});expect(fetcher).toHaveBeenCalledTimes(1);const data=await loadBatch(dir);expect(data.records[0].failureCode).toBe('authentication');expect(await readFile(`${dir}/A01.json`,'utf8')).not.toContain('SECRET');expect(summarizeBatch(b,data.records).full60Rate).toBeNull();
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('passes configured relay parameters, preserves actual usage, and strips invalid/credential-echo output',async()=>{
  const c=validateConfig({provider:'compatible',model:'test-model',origin:'http://localhost:3000',connection:{baseUrl:'https://api.aicodemirror.ai/v1',protocol:'responses',outputMode:'json_schema'}});
  const proposal=(await new MockPlanner().generate(FOUNDATION_CASES[0].input)).proposal;
  for(const echo of [false,true]){
   const dir=await mkdtemp(join(tmpdir(),'lifequest-eval-'));try{const b=await prepareBatch('real',c);b.slots=b.slots.slice(0,1);
    const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{expect(JSON.parse(init!.body as string)).toMatchObject({provider:'compatible',model:'test-model',connection:c.connection});expect(init!.redirect).toBe('error');return Response.json({versions:PLANNER_VERSIONS,proposal:echo?{...proposal,reasoning:'PRIVATE_KEY_ABC'}:proposal,usage:{inputTokens:10,outputTokens:20,totalTokens:30,authorization:'PRIVATE_KEY_ABC'}});});
    await collectBatch(dir,b,'PRIVATE_KEY_ABC',{fetcher:fetcher as typeof fetch});const raw=await readFile(`${dir}/A01.json`,'utf8');expect(raw).not.toContain('PRIVATE_KEY_ABC');const r=JSON.parse(raw);expect(r.usage).toEqual({inputTokens:10,outputTokens:20,totalTokens:30});expect(r.structure).toBe(!echo);expect(r.proposal===null).toBe(echo);
   }finally{await rm(dir,{recursive:true,force:true});}
  }
 });
});
