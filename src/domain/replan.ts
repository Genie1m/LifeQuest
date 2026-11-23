import {DomainError} from './commands';
import {parseSnapshot} from './validation';
import {parseProposal,type PlanningInput} from './proposal';
import type {AppSnapshot,Goal,PlanContent,ReplanSettings,Task} from './types';
const fail=(message:string):never=>{throw new DomainError('invalid-input',message);};
export const pendingTasks=(g:Goal)=>g.confirmedPlan?.content.stages.flatMap(s=>s.tasks).filter(t=>t.status==='pending')??[];
export function validateSettings(raw:ReplanSettings,g:Goal){
 if(raw?.requestedWeeks!==undefined&&(!Number.isInteger(raw.requestedWeeks)||raw.requestedWeeks<1||raw.requestedWeeks>520))fail('期望参考周期无效。');
 if(!raw||typeof raw!=='object'||!Number.isFinite(raw.weeklyHours)||raw.weeklyHours<1||raw.weeklyHours>40||!Number.isInteger(raw.windowWeeks)||raw.windowWeeks<1||raw.windowWeeks>520||typeof raw.feedback!=='string'||!raw.feedback.trim()||raw.feedback.length>1000||!['extend','defer'].includes(raw.strategy))fail('请填写1～40小时的新周预算、1～520周的参考周期及1000字以内执行反馈。');
 const pending=new Set(pendingTasks(g).map(t=>t.id));
 if(!Array.isArray(raw.selectedTaskIds)||!raw.selectedTaskIds.length||new Set(raw.selectedTaskIds).size!==raw.selectedTaskIds.length||raw.selectedTaskIds.some(id=>!pending.has(id)))fail('调整范围必须是本目标尚未完成的任务，且不能重复。');
 if(!Array.isArray(raw.deferredTaskIds)||new Set(raw.deferredTaskIds).size!==raw.deferredTaskIds.length||raw.deferredTaskIds.some(id=>!raw.selectedTaskIds.includes(id))||(raw.strategy==='extend'&&raw.deferredTaskIds.length))fail('推迟项必须属于选中的未完成范围；延长方案不推迟任务。');
}
export function feasibility(g:Goal,settings:ReplanSettings,content=g.confirmedPlan!.content){
 const tasks=content.stages.flatMap(s=>s.tasks).filter(t=>t.status==='pending');const total=tasks.reduce((n,t)=>n+t.estimatedMinutes,0);const deferred=tasks.filter(t=>settings.deferredTaskIds.includes(t.id)).reduce((n,t)=>n+t.estimatedMinutes,0);const required=total-deferred;const capacity=settings.weeklyHours*60*settings.windowWeeks;
 return {total,deferred,required,capacity,gap:Math.max(0,required-capacity),minimumWeeks:Math.max(1,Math.ceil(required/(settings.weeklyHours*60))),allWeeks:Math.max(1,Math.ceil(total/(settings.weeklyHours*60))),fits:required<=capacity};
}
function target(s:AppSnapshot,id:string){parseSnapshot(s);const g=s.goals.find(g=>g.id===id);if(!g?.confirmedPlan||!['active','paused'].includes(g.status))return fail('仅活跃或暂停的正式冒险可重规划。');return g;}
function replace(s:AppSnapshot,g:Goal){return parseSnapshot({...s,goals:s.goals.map(x=>x.id===g.id?g:x)});}
export function startReplan(s:AppSnapshot,id:string,baseline:string,settings:ReplanSettings){
 const g=target(s,id);if(JSON.stringify(g)!==baseline||g.draft)fail('目标已变化或已有修订草稿，请先处理现有草稿。');validateSettings(settings,g);
 return replace(s,{...g,draft:{baseRevision:g.confirmedPlan!.revision,source:'manual',updatedAt:new Date().toISOString(),proposedWeeklyHours:settings.weeklyHours,adjustmentFeedback:settings.feedback,replan:structuredClone(settings),content:structuredClone(g.confirmedPlan!.content)}});
}
/** Reset the draft in one candidate/write; failed persistence keeps the previous draft. */
export function restartReplan(s:AppSnapshot,id:string,baseline:string,settings:ReplanSettings){
 const clean=discardReplan(s,id,baseline);return startReplan(clean,id,JSON.stringify(clean.goals.find(g=>g.id===id)),settings);
}
export function replanContent(g:Goal,input?:PlanContent){
 const content=input??g.draft?.content;if(!content)return fail('请先创建重规划草稿。');
 const draft=g.draft;if(!draft?.replan||!g.confirmedPlan||draft.baseRevision!==g.confirmedPlan.revision)fail('重规划基线无效。');const settings=draft!.replan!;validateSettings(settings,g);
 const original=g.confirmedPlan!.content;
 if(content.stages.length!==original.stages.length)fail('重规划不能删除、增加或移动原章节。');
 original.stages.forEach((stage,i)=>{const next=content.stages[i];if(JSON.stringify({...next,tasks:[]})!==JSON.stringify({...stage,tasks:[]})||next.tasks.length!==stage.tasks.length)fail('章节信息与任务数量必须保留。');stage.tasks.forEach((task,j)=>{const changed=next.tasks[j];if(!changed||changed.id!==task.id)fail('任务标识与顺序必须保留。');const editable=task.status==='pending'&&settings.selectedTaskIds.includes(task.id)&&!settings.deferredTaskIds.includes(task.id);
  const expected=editable?{...task,title:changed.title,description:changed.description,doneCriteria:changed.doneCriteria,estimatedMinutes:changed.estimatedMinutes}:task;
  if(JSON.stringify(changed)!==JSON.stringify(expected))fail('已完成、未选中、推迟任务及其历史字段不能改变。');
  if(editable&&changed.estimatedMinutes<task.estimatedMinutes&&changed.title===task.title&&changed.description===task.description&&changed.doneCriteria===task.doneCriteria)fail('不能只缩短预计时间：请同步说明新的行动范围／步骤或完成标准，并在预览中核对未降低最终要求。');
  if(editable&&(!changed.title.trim()||!changed.doneCriteria.trim()||changed.estimatedMinutes<5||changed.estimatedMinutes>600))fail('调整任务必须有具体标题、完成标准和5～600分钟估时。');
 });});
 return content;
}
export function saveReplan(s:AppSnapshot,id:string,baseline:string,content:PlanContent){const g=target(s,id);if(JSON.stringify(g)!==baseline)fail('目标已变化，请重新读取。');replanContent(g,content);return replace(s,{...g,draft:{...g.draft!,content:structuredClone(content),updatedAt:new Date().toISOString()}});}
export interface ReplanReview {revision:number;goal:string;preservesCriteria:boolean;reason:string}
export function confirmReplan(s:AppSnapshot,id:string,review:ReplanReview){
 const g=target(s,id);if(!review||s.revision!==review.revision||JSON.stringify(g)!==review.goal)fail('重规划预览已过期。');const content=replanContent(g);const settings=g.draft!.replan!;
 if(review.preservesCriteria!==true||typeof review.reason!=='string'||!review.reason.trim()||review.reason.length>1000)fail('请明确核对原成功标准与任务差异，并记录范围、耗时和验收标准联动调整的依据。');
 if(!feasibility(g,settings,content).fits)fail('新方案在参考周期内仍超出预算，请延长期限或重新调整任务，不能直接宣称可行。');
 const next:Goal={...g,weeklyHours:settings.weeklyHours,confirmedPlan:{...g.confirmedPlan!,revision:g.confirmedPlan!.revision+1,content:structuredClone(content),confirmedAt:new Date().toISOString(),adjustmentReview:review.reason,adjustment:{...settings,feedback:settings.feedback}}};delete next.draft;return replace(s,next);
}
export function discardReplan(s:AppSnapshot,id:string,baseline:string){const g=target(s,id);if(JSON.stringify(g)!==baseline||!g.draft?.replan)fail('草稿已变化。');const next={...g};delete next.draft;return replace(s,next);}
export function taskChanges(g:Goal,content=g.draft!.content){return g.confirmedPlan!.content.stages.flatMap((s,i)=>s.tasks.map((before,j)=>({before,after:content.stages[i].tasks[j],deferred:g.draft!.replan!.deferredTaskIds.includes(before.id),previouslyDeferred:g.confirmedPlan!.adjustment?.deferredTaskIds.includes(before.id)??false}))).filter(x=>x.deferred||x.previouslyDeferred!==x.deferred||JSON.stringify(x.before)!==JSON.stringify(x.after));}
export function replanInput(g:Goal):PlanningInput{
 const settings=g.draft!.replan!;const tasks=pendingTasks(g).filter(t=>settings.selectedTaskIds.includes(t.id)&&!settings.deferredTaskIds.includes(t.id));if(!tasks.length)fail('没有需AI修改的任务，可直接手动审阅。');
 const context=JSON.stringify({mode:'budget-replan',settings:{weeklyHours:settings.weeklyHours,windowWeeks:settings.windowWeeks,feedback:settings.feedback},tasks:tasks.map((t,i)=>({ref:`rt${i}`,title:t.title,description:t.description,doneCriteria:t.doneCriteria,estimatedMinutes:t.estimatedMinutes,difficulty:t.difficulty})),budget:feasibility(g,settings),instruction:'Return exactly one stage, one task per requested ref. Preserve each rtN ref exactly; no additions, omissions or merging. Revise action scope, minutes and verifiable criteria together. Do not merely multiply durations. Final goal successCriteria remains binding. Deferred tasks are postponed, not achieved or removed.'});
 if(context.length>12000)fail('所选任务内容过长，请缩小调整范围或手动修改。');return {title:g.title,successCriteria:g.successCriteria,baseline:g.baseline,direction:g.direction,weeklyHours:settings.weeklyHours,preferences:'',constraints:'不得修改已完成成果、未选中任务或最终成功标准。',requirements:'只为replanContext内的任务提出具体修订；reasoning说明范围、估时、验收条件的联动及不可行风险。',replanContext:context};
}
export function importReplan(g:Goal,raw:unknown){const input=replanInput(g);const requested=JSON.parse(input.replanContext!).tasks as {ref:string}[];const p=parseProposal(raw);const tasks=p.stages.flatMap(s=>s.tasks);if(p.stages.length!==1||tasks.length!==requested.length||new Set(tasks.map(t=>t.ref)).size!==tasks.length||requested.some(r=>!tasks.some(t=>t.ref===r.ref)))fail('AI修订必须逐一覆盖请求的rt引用，不得遗漏、新增或合并任务。');const originals=pendingTasks(g).filter(t=>g.draft!.replan!.selectedTaskIds.includes(t.id)&&!g.draft!.replan!.deferredTaskIds.includes(t.id));const patches=new Map(originals.map((t,i)=>[t.id,tasks.find(x=>x.ref===`rt${i}`)!]));const content={stages:g.draft!.content.stages.map(s=>({...s,tasks:s.tasks.map(t=>{const patch=patches.get(t.id);if(!patch)return t;if(patch.difficulty!==t.difficulty)fail('重规划不能改变任务的XP难度。');const {title,description,doneCriteria,estimatedMinutes}=patch;return {...t,title,description,doneCriteria,estimatedMinutes} as Task;})}))};replanContent(g,content);return content;}
