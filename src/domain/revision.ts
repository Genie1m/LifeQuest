import {DomainError} from './commands';
import {planIssues} from './plan-readiness';
import {proposalContent,type ProposalBaseline} from './proposal';
import {parseSnapshot} from './validation';
import type {AppSnapshot,Goal,PlanContent,Stage} from './types';
const fail=(message:string):never=>{throw new DomainError('invalid-transition',message);};
function target(s:AppSnapshot,id:string){parseSnapshot(s);const g=s.goals.find(g=>g.id===id);if(!g||!['active','paused'].includes(g.status)||!g.confirmedPlan)return fail('仅活跃或暂停的正式计划可以创建修订。');if(g.draft?.replan)fail('请在时间预算重规划入口处理此草稿。');return g;}
function preserveStage(stage:Stage){return stage.tasks.some(task=>task.status==='completed'||task.progress!==undefined);}
export function protectedStages(g:Goal){return g.confirmedPlan!.content.stages.filter(preserveStage);}
function validatePending(g:Goal,content:PlanContent,ready:boolean){const issues=planIssues(content,ready);if(issues.length)fail(issues[0].message);const locked=new Set(protectedStages(g).flatMap(st=>[st.id,...st.tasks.map(t=>t.id)]));if(content.stages.some(st=>[st.id,...st.tasks.map(t=>t.id)].some(id=>locked.has(id))))fail('修订不能复用或修改保留章节的标识。');}
export function revisionContent(g:Goal):PlanContent {
 if(!g.confirmedPlan||!g.draft||g.draft.baseRevision!==g.confirmedPlan.revision)return fail('修订基线已变化，请重新打开。');
 if(g.draft.proposedWeeklyHours!==undefined&&g.draft.proposedWeeklyHours!==g.weeklyHours)return fail('当前修订不修改周投入；请保留旧草稿内容后，放弃旧修订并重新创建。');
 validatePending(g,g.draft.content,true);
 const pending=structuredClone(g.draft.content.stages);const stages=[];const locked=new Set(protectedStages(g).map(st=>st.id));
 for(const st of g.confirmedPlan.content.stages){if(locked.has(st.id)){if(stages.length!==g.confirmedPlan.content.stages.indexOf(st))fail('请保留足够的待办章节，以保持已有成果章节的位置。');stages.push(structuredClone(st));}else if(pending.length)stages.push(pending.shift()!);}
 stages.push(...pending);const content={stages};
 if(content.stages.length>10||content.stages.flatMap(st=>st.tasks).length>50)fail('保留成果与新任务合计不能超过10章、50项任务。');return content;
}
function replace(s:AppSnapshot,g:Goal){return parseSnapshot({...s,goals:s.goals.map(old=>old.id===g.id?g:old)});}
export function startRevision(s:AppSnapshot,id:string,baseline:string){const g=target(s,id);if(JSON.stringify(g)!==baseline)fail('目标已变化，请重新打开。');if(g.draft)return s;const stages=g.confirmedPlan!.content.stages.filter(st=>!preserveStage(st));if(!stages.length)fail('剩余任务均位于已有进展或成果的章节，请使用时间预算重规划逐项调整。');return replace(s,{...g,draft:{baseRevision:g.confirmedPlan!.revision,content:{stages:structuredClone(stages)},source:'manual',updatedAt:new Date().toISOString()}});}
export function saveRevision(s:AppSnapshot,id:string,content:PlanContent){const g=target(s,id);if(!g.draft)fail('请先创建修订草稿。');validatePending(g,content,false);return replace(s,{...g,draft:{...g.draft!,content:structuredClone(content),updatedAt:new Date().toISOString()}});}
export function importRevisionProposal(s:AppSnapshot,b:ProposalBaseline,raw:unknown){const g=target(s,b.goalId);if(!g.draft||s.revision!==b.revision||JSON.stringify(g)!==b.goal)fail('此修订建议已过期，请重新生成。');const content=proposalContent(raw);const next=saveRevision(s,g.id,content);revisionContent(next.goals.find(v=>v.id===g.id)!);return content;}
export function confirmRevision(s:AppSnapshot,id:string,review:{revision:number;goal:string}){const g=target(s,id);if(s.revision!==review.revision||JSON.stringify(g)!==review.goal)fail('修订预览已过期，请重新预览。');const content=revisionContent(g);const next={...g,confirmedPlan:{revision:g.confirmedPlan!.revision+1,content,confirmedAt:new Date().toISOString()}};delete next.draft;return replace(s,next);}
export function discardRevision(s:AppSnapshot,id:string,baseline:string){const g=target(s,id);if(JSON.stringify(g)!==baseline)fail('目标已变化，请重新打开。');const next={...g};delete next.draft;return replace(s,next);}
export function contextForPlan(g:Goal){const summary=JSON.stringify({mode:g.status==='draft'?'initial':'replace-only-fully-pending-chapters',protectedChapters:g.confirmedPlan?protectedStages(g).map(st=>({title:st.title,tasks:st.tasks.map(t=>({title:t.title,status:t.status}))})):[],editableChapters:g.draft?.content.stages.map(st=>({title:st.title,tasks:st.tasks.map(t=>({title:t.title,doneCriteria:t.doneCriteria}))}))??[]});return summary.length>1950?summary.slice(0,1900)+' [摘要已截断；不要视为完整计划，不重复保留章节，不降低最终成功标准]':summary;}
