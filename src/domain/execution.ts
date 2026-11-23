import {DomainError,clearFocus} from './commands';
import {characterGrowth} from './progression';
import {parseSnapshot} from './validation';
import {TASK_PROGRESS_LABELS, type AppSnapshot, type Difficulty, type Goal, type Stage, type Task, type TaskProgressStatus} from './types';

export const TASK_XP:Record<Difficulty,number>={light:20,standard:40,challenge:60};
export function stageProgress(stage: Stage) {
 const total = stage.tasks.length;
 const done = stage.tasks.filter(task => task.status === 'completed').length;
 const checkpointReached = stage.tasks.some(task => task.id === stage.checkpointTaskId && task.status === 'completed');
 return {done, total, checkpointReached, complete: total > 0 && done === total};
}

function allStagesComplete(stages: Stage[]) {
 return stages.length > 0 && stages.every(stage => stageProgress(stage).complete);
}
export function goalProgress(goal:Goal){
 const stages=goal.confirmedPlan?.content.stages??[];
 const tasks=stages.flatMap(s=>s.tasks);const done=tasks.filter(t=>t.status==='completed').length;
 const recommended = (t: Task) => t.status === 'pending' && (
  t.progress?.status === 'in-progress' || (!t.progress && !goal.confirmedPlan?.adjustment?.deferredTaskIds.includes(t.id))
 );
 const nextStage=stages.find(s=>s.tasks.some(recommended));
 return {done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0,completedStages:stages.filter(s=>stageProgress(s).complete).length,nextStage,nextTask:nextStage?.tasks.find(recommended)};
}
export function achievements(snapshot:AppSnapshot){
 return [
  {id:'first-task',title:'踏出第一步',description:'完成第一项真实任务',unlocked:snapshot.completions.length>0},
  {id:'first-stage',title:'章节开拓者',description:'完成一个章节的全部任务',unlocked:snapshot.goals.some(g=>g.confirmedPlan?.content.stages.some(s=>stageProgress(s).complete))},
  {id:'first-goal',title:'抵达终点',description:'完成第一条冒险的全部任务',unlocked:snapshot.goals.some(g=>g.status==='completed')},
 ];
}
export interface CompletionReceipt {taskTitle:string;xp:number;direction:Goal['direction'];levelBefore:number;levelAfter:number;stageCompleted:boolean;goalCompleted:boolean;nextStageTitle?:string;newAchievements:string[]}
export interface CompletionReview {goal:string;confirmed:boolean}
export function recordTaskProgress(snapshot: AppSnapshot, goalId: string, taskId: string, baseline: string, status: TaskProgressStatus | 'pending', note: string) {
 parseSnapshot(snapshot);
 const goal = snapshot.goals.find(item => item.id === goalId);
 const plan = goal?.confirmedPlan;
 const task = plan?.content.stages.flatMap(stage => stage.tasks).find(item => item.id === taskId);
 if (!goal || !plan || task?.status !== 'pending' || goal.status !== 'active' || goal.draft) {
  throw new DomainError('invalid-transition', '只有当前可执行的未完成任务可以保存进展。');
 }
 if (JSON.stringify(goal) !== baseline) throw new DomainError('invalid-input', '任务状态已变化，请重新打开记录。');
 if ((status !== 'pending' && !Object.hasOwn(TASK_PROGRESS_LABELS, status)) || typeof note !== 'string' || note.trim().length > 1000 || (status === 'blocked' && !note.trim())) {
  throw new DomainError('invalid-input', '请填写受阻原因，进展备注最多 1000 字。');
 }
 const updated = {...task};
 if (status === 'pending') delete updated.progress;
 else updated.progress = {status, note: note.trim()};
 const content = {stages: plan.content.stages.map(stage => ({
  ...stage, tasks: stage.tasks.map(item => item.id === taskId ? updated : item),
 }))};
 return parseSnapshot({...snapshot, goals: snapshot.goals.map(item =>
  item.id === goalId ? {...goal, confirmedPlan: {...plan, content}} : item
 )});
}

/** One pure candidate transaction. Only Repository success may publish/play its receipt. */
export function completeTask(snapshot:AppSnapshot,goalId:string,taskId:string,review:CompletionReview,note='',now=()=>new Date().toISOString()):{snapshot:AppSnapshot;receipt:CompletionReceipt|null}{
 parseSnapshot(snapshot);const goal=snapshot.goals.find(g=>g.id===goalId);
 const stage=goal?.confirmedPlan?.content.stages.find(s=>s.tasks.some(t=>t.id===taskId));const task=stage?.tasks.find(t=>t.id===taskId);
 if(!goal||!stage||!task)throw new DomainError('invalid-input','未找到此目标的正式任务，请重新打开任务。');
 if(snapshot.completions.some(e=>e.taskId===taskId))return {snapshot,receipt:null};
 if(goal.status!=='active'||goal.draft)throw new DomainError('invalid-transition','仅活跃且没有待确认修订草稿的冒险可以提交成果。请先恢复冒险或处理修订。');
 if(!review||review.confirmed!==true||review.goal!==JSON.stringify(goal))throw new DomainError('invalid-input','任务确认已过期或尚未核对完成标准，请重新打开确认。');
 if(typeof note!=='string'||note.trim().length>1000)throw new DomainError('invalid-input','成果记录不能超过1000字。');
 const completedAt=now();const xp=TASK_XP[task.difficulty];const before=characterGrowth(goal.characterId,snapshot.completions);
 const settled = {...task, status: 'completed' as const, completedAt};
 delete settled.progress;
 const content={stages:goal.confirmedPlan!.content.stages.map(s=>s.id!==stage.id?s:{...s,tasks:s.tasks.map(t=>t.id!==task.id?t:settled)})};
 const goalCompleted=allStagesComplete(content.stages);
 const updated:Goal={...goal,confirmedPlan:{...goal.confirmedPlan!,content},...(goalCompleted?{status:'completed',completedAt}:{})};
 const candidate={...snapshot,goals:snapshot.goals.map(g=>g.id===goal.id?updated:g),completions:[...snapshot.completions,{taskId:task.id,goalId:goal.id,stageId:stage.id,characterId:goal.characterId,direction:goal.direction,xp,difficulty:task.difficulty,taskTitle:task.title,stageTitle:stage.title,completedAt,...(note.trim()?{note:note.trim()}:{})}]};
 const next=parseSnapshot(goalCompleted&&snapshot.focusGoalId===goal.id?clearFocus(candidate):candidate);
 const after=characterGrowth(goal.characterId,next.completions);const previous=achievements(snapshot);const progress=goalProgress(updated);
 return {snapshot:next,receipt:{taskTitle:task.title,xp,direction:goal.direction,levelBefore:before.level,levelAfter:after.level,stageCompleted:stageProgress(content.stages.find(s=>s.id===stage.id)!).complete,goalCompleted,nextStageTitle:progress.nextStage?.title,newAchievements:achievements(next).filter(a=>a.unlocked&&!previous.find(p=>p.id===a.id)?.unlocked).map(a=>a.title)}};
}
