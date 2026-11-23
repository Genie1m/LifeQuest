import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseProposal,PROPOSAL_SCHEMA,ProposalValidationError,type PlanProposal} from '@/domain/proposal';
import {CompatibleAdapter} from './compatible';
import {OpenAIAdapter} from './server';
import {defaultConnection} from './connection';
import {MockPlanner} from './mock';
import {EVALUATION_CASES} from './evaluation-cases';
import {outputInstructions,PLAN_INSTRUCTIONS} from './instructions';
import {POST} from '@/app/api/planner/route';

// Synthetic malformed responses, not evidence of what the user's relay returned.
const proposal=async()=>structuredClone((await new MockPlanner().generate(EVALUATION_CASES[0])).proposal);
const completed=(output:unknown)=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

describe('strict proposal diagnostics without model text disclosure',()=>{
 it.each([
  ['missing criteria','proposal.stages[0].tasks[0].doneCriteria',(p:PlanProposal)=>{Reflect.deleteProperty(p.stages[0].tasks[0],'doneCriteria');}],
  ['null description','proposal.stages[0].tasks[0].description',(p:PlanProposal)=>{Object.assign(p.stages[0].tasks[0],{description:null});}],
  ['translated difficulty','proposal.stages[0].tasks[0].difficulty',(p:PlanProposal)=>{Object.assign(p.stages[0].tasks[0],{difficulty:'轻量'});}],
  ['fractional minutes','proposal.stages[0].tasks[0].estimatedMinutes',(p:PlanProposal)=>{p.stages[0].tasks[0].estimatedMinutes=5.5;}],
  ['duplicate task refs','proposal.stages[1].tasks[0].ref',(p:PlanProposal)=>{p.stages[1].tasks[0].ref=p.stages[0].tasks[0].ref;}],
  ['stage/task collision','proposal.stages[0].tasks[0].ref',(p:PlanProposal)=>{p.stages[0].tasks[0].ref=p.stages[0].ref;}],
  ['foreign checkpoint','proposal.stages[0].checkpointRef',(p:PlanProposal)=>{p.stages[0].checkpointRef=p.stages[1].tasks[0].ref;}],
  ['non-ASCII ref','proposal.stages[0].ref',(p:PlanProposal)=>{p.stages[0].ref='章节一';}],
  ['empty title','proposal.stages[0].title',(p:PlanProposal)=>{p.stages[0].title=' ';}],
 ] as const)('reports the exact safe path for %s',async(_name,path,change)=>{
  const p=await proposal();change(p);
  try{parseProposal(p);expect.fail('must reject');}catch(e){expect(e).toBeInstanceOf(ProposalValidationError);expect((e as ProposalValidationError).issue.path).toBe(path);}
 });
 it('explains schema-definition output and keeps wire ref rules aligned with local validation',()=>{
  expect(()=>parseProposal(PROPOSAL_SCHEMA)).toThrow('JSON Schema定义');
  expect(PROPOSAL_SCHEMA.properties!.stages.items!.properties!.ref.pattern).toBe('^[A-Za-z][A-Za-z0-9_-]{0,39}$');
 });
 it('never echoes arbitrary field names or values',async()=>{
  const p=await proposal();Object.assign(p.stages[0].tasks[0],{'private-field-name':'private-model-value'});
  try{parseProposal(p);expect.fail('must reject');}catch(e){const text=JSON.stringify(e)+String(e);expect(text).not.toContain('private-field-name');expect(text).not.toContain('private-model-value');expect(text).toContain('未声明字段');}
 });
 it('keeps the whole-plan task cap even when individual arrays fit',async()=>{
  const p=await proposal();p.stages=p.stages.slice(0,2);p.stages.forEach((s,i)=>{s.tasks=Array.from({length:26},(_,j)=>({...s.tasks[0],ref:`s${i}_t${j}`}));s.checkpointRef=s.tasks[0].ref;});
  expect(()=>parseProposal(p)).toThrow('合计不能超过50项');
 });
 it.each(['responses','chat','official'] as const)('preserves precise validation failure through %s without retry',async protocol=>{
  const p=await proposal();p.stages[0].checkpointRef=p.stages[0].ref;
  const raw=protocol==='chat'?{choices:[{finish_reason:'stop',message:{content:JSON.stringify(p)}}]}:completed(p);
  const request=vi.fn().mockResolvedValue(Response.json(raw));
  const adapter=protocol==='official'?new OpenAIAdapter('fixture-not-real','gpt-5.6-terra',request):new CompatibleAdapter('fixture-not-real','gpt-6.1-sol','compatible',{...defaultConnection('compatible'),protocol},request);
  await expect(adapter.generate({...EVALUATION_CASES[0],currentPlan:'Synthetic editable chapter summary'})).rejects.toMatchObject({code:'invalid-response',validationIssue:{path:'proposal.stages[0].checkpointRef'}});
  expect(request).toHaveBeenCalledTimes(1);
 });
 it('returns a safe field diagnosis and request ID through the API, never the rejected content',async()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('LIFEQUEST_ENABLE_REAL_LLM','true');
  const p=await proposal();p.reasoning='private-reasoning';p.stages[0].tasks[0].doneCriteria='';
  const network=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(completed(p)));
  const r=await POST(new Request('http://127.0.0.1:3000/api/planner',{method:'POST',headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000','content-type':'application/json','x-lifequest-api-key':'fixture-not-real'},body:JSON.stringify({operation:'generate',provider:'compatible',model:'gpt-6.1-sol',connection:defaultConnection('compatible'),input:EVALUATION_CASES[0]})}));
  expect(r.status).toBe(502);const body=await r.json();expect(body.code).toBe('invalid-response');expect(body.validationIssue.path).toBe('proposal.stages[0].tasks[0].doneCriteria');expect(body.message).toContain(body.validationIssue.path);expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);expect(body).not.toHaveProperty('upstreamStatus');expect(body).not.toHaveProperty('proposal');expect(JSON.stringify(body)).not.toMatch(/private-reasoning|fixture-not-real/);expect(network).toHaveBeenCalledTimes(1);
 });
 it('gives explicit instance and cross-field rules, separate from the minimal connection test',()=>{
  expect(PLAN_INSTRUCTIONS).toContain('JSON INSTANCE');expect(PLAN_INSTRUCTIONS).toContain('globally unique');expect(PLAN_INSTRUCTIONS).toContain("same stage's task.ref");expect(outputInstructions(PROPOSAL_SCHEMA,true)).not.toContain('Output exactly this JSON Schema');
  const connection=outputInstructions({type:'object'},false);expect(connection).toContain('{"ok":true}');expect(connection).not.toContain('growth planner');
 });
 it('actually sends different connection and planning instructions to the relay',async()=>{
  const p=await proposal();const request=vi.fn().mockResolvedValueOnce(Response.json(completed({ok:true}))).mockResolvedValueOnce(Response.json(completed(p)));
  const adapter=new CompatibleAdapter('fixture-not-real','gpt-6.1-sol','compatible',defaultConnection('compatible'),request);
  await adapter.test();await adapter.generate(EVALUATION_CASES[0]);
  expect(JSON.parse(request.mock.calls[0][1].body).instructions).not.toContain('growth planner');expect(JSON.parse(request.mock.calls[1][1].body).instructions).toContain('globally unique');
 });
});
