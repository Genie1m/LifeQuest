import {describe,it,expect} from 'vitest';
import {parseProposal,type PlanProposal,type ProposalTask} from './proposal';
import {proposalReview,PLAN_REVIEW_VERSION} from './plan-quality';

// Purpose-written regression examples; not copied model answers or model quality scores.
const task=(patch:Partial<ProposalTask>={}):ProposalTask=>({ref:'t1',title:'实现读取并核验程序',description:'1. 读取合成输入。\n2. 核对预期输出。',doneCriteria:'保存程序，全部核心检查通过。',estimatedMinutes:30,difficulty:'standard',...patch});
function plan(tasks:ProposalTask[]=[task()]):PlanProposal{return parseProposal({reasoning:'按真实工作量推进。',assumptions:[],warnings:[],stages:[{ref:'s1',title:'交付程序',milestone:'程序实际可用',checkpointRef:tasks.at(-1)!.ref,tasks}]});}
const codes=(p:PlanProposal,input={})=>proposalReview(p,3,false,input).issues.map(i=>i.code);

describe('delivery-contract regression, advisory checks only',()=>{
 it.each(['保存测试记录，未通过项清楚标注。','运行程序，若无法运行则记录失败原因。'])('finds failure-as-delivery even when the title starts with 检查: %s',doneCriteria=>{
  const p=plan([task({title:'检查并修复读取程序',doneCriteria})]);const original=JSON.stringify(p);
  expect(codes(p)).toContain('failure-as-delivery');expect(JSON.stringify(p)).toBe(original);expect(()=>parseProposal(p)).not.toThrow();
 });
 it('allows an honest diagnostic report and actual imperfect practice',()=>{
  const p=plan([task({title:'诊断读取错误',doneCriteria:'若无法复现，记录原因和已检查的输入版本。'}),task({ref:'t2',title:'录制模拟讲解',doneCriteria:'保存完整模拟录像与两条定位明确的改进记录；未改善处作为下次练习输入。'})]);
  expect(codes(p)).not.toContain('failure-as-delivery');
 });
 it('requires a usable completion path when no defect appears',()=>{
  const p=plan([task({title:'复现并修复一次实际错误',doneCriteria:'保存错误现象—原因—修复记录。'})]);expect(codes(p)).toContain('forced-defect');
  p.stages[0].tasks[0].description+='\n3. 未发现问题时保存全部通过证据，另跑预设边界用例。';expect(codes(p)).not.toContain('forced-defect');
 });
 it('uses the explicit single-session window and locates grouped production tasks',()=>{
  const review=proposalReview(plan([task({title:'拍摄其余三组素材',estimatedMinutes:150})]),2,false,{preferences:'工作日每次约30分钟整理'});
  expect(review.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'session-window',taskRef:'t1',stageRef:'s1'}),expect.objectContaining({code:'bundled-outputs'})]));
  expect(review.version).toBe(PLAN_REVIEW_VERSION);expect(review.semanticStatus).toBe('needs-user-review');
 });
 it('does not forbid genuine long sessions or claim a perfect short task is semantically valid',()=>{
  const p=plan([task({title:'拍摄一组夜景',estimatedMinutes:90,description:'1. 在允许的时段完成拍摄。\n2. 中途可在两处场景之间暂停，重新核对光线。'})]);
  expect(codes(p)).toContain('long-session');expect(codes(p)).not.toContain('bundled-outputs');expect(()=>parseProposal(p)).not.toThrow();
  expect(proposalReview(plan(),5).semanticStatus).toBe('needs-user-review');
 });
 it('checks an explicit output count without inventing a required number of photos per group',()=>{
  const p=plan([task({doneCriteria:'保存可展示文件并核对所有图片。'})]);
  expect(codes(p,{successCriteria:'完成五组作品并整理展示'})).toContain('coverage-count');
  p.stages[0].tasks[0].doneCriteria='五组主题作品齐全，图片可打开并逐组核验。';expect(codes(p,{successCriteria:'完成5组主题作品'})).not.toContain('coverage-count');
 });
 it('separates observation weeks from workload weeks and recognizes explicit week ranges',()=>{
  const p=plan([task({title:'回顾四周实践',doneCriteria:'保存回顾记录。'})]);
  expect(codes(p,{requirements:'先实践4周'})).toContain('practice-window');
  expect(proposalReview(p,5,false,{requirements:'先实践4周'}).practiceWindowWeeks).toBe(4);
  p.stages[0].tasks[0].description='第1周完成记录；第2—3周分别执行并记录；第4周实际执行并复盘。';expect(codes(p,{requirements:'先实践四周'})).not.toContain('practice-window');
 });
 it('flags early checkpoints as review items without silently moving or rejecting them',()=>{
  const p=plan([task(),task({ref:'t2',title:'补充可选练习'})]);p.stages[0].checkpointRef='t1';
  expect(codes(p)).toContain('checkpoint-order');expect(p.stages[0].checkpointRef).toBe('t1');expect(()=>parseProposal(p)).not.toThrow();
 });
 it('preserves task-scoped identities and excludes whole-goal coverage judgments',()=>{
  const p=plan([task({title:'编辑五组照片',estimatedMinutes:180}),task({ref:'t2'})]);p.stages[0].checkpointRef='t1';
  const r=proposalReview(p,2,true,{successCriteria:'交付五组作品',requirements:'先实践4周'});
  expect(r.issues.map(i=>i.code)).not.toEqual(expect.arrayContaining(['checkpoint-order','coverage-count','practice-window']));
  expect(r.issues.every(i=>!['checkpoint-order','coverage-count','practice-window'].includes(i.code))).toBe(true);
  expect(r.issues.find(i=>i.code==='long-session')!.suggestion).toContain('保留原任务标识');expect(p.stages[0].tasks.map(t=>t.ref)).toEqual(['t1','t2']);
 });
 it('does not demand whole-goal quantities or completed practice from a replacement chapter',()=>{
  const p=plan([task(),task({ref:'t2'})]);p.stages[0].checkpointRef='t1';
  const r=proposalReview(p,2,'chapters',{successCriteria:'交付五组作品',requirements:'先实践4周'});
  expect(r.scope).toBe('editable-chapters');expect(r.practiceWindowWeeks).toBeNull();
  expect(r.issues.map(i=>i.code)).toContain('checkpoint-order');expect(r.issues.some(i=>['coverage-count','practice-window'].includes(i.code))).toBe(false);
  expect(r.requirements[0].text).toBe('交付五组作品');
 });
});
