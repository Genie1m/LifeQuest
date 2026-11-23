"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAppState } from "@/state/AppProvider";
import { activateGoal, DomainError } from "@/domain/commands";
import { planIssues } from "@/domain/editor";
import { DIRECTIONS } from "@/domain/catalog";
import {TASK_PROGRESS_LABELS, type Goal} from "@/domain/types";
import { Button } from "./ui/button";
import {TASK_XP} from '@/domain/execution';
import {PlanEstimate} from './plan-estimate';

export function PlanContents({ goal }: { goal: Goal }) {
  const content = goal.confirmedPlan?.content ?? goal.draft?.content;
  const tasks = content?.stages.flatMap(s => s.tasks) ?? [];
  return <div className="plan-contents"><h2>{goal.title}</h2><dl className="goal-facts"><div><dt>成功标准</dt><dd>{goal.successCriteria}</dd></div><div><dt>当前基础</dt><dd>{goal.baseline}</dd></div><div><dt>方向与投入</dt><dd>{DIRECTIONS.find(d=>d.id===goal.direction)?.name} · 每周 {goal.draft?.proposedWeeklyHours ?? goal.weeklyHours} 小时</dd></div></dl><p>{content?.stages.length ?? 0} 章 · {tasks.length} 项任务 · 全部完成可获 {tasks.reduce((n,t)=>n+TASK_XP[t.difficulty],0)} XP（已获部分不重复结算）</p><PlanEstimate tasks={tasks} weeklyHours={goal.draft?.proposedWeeklyHours??goal.weeklyHours}/>{content?.stages.map((s,i)=><section className="saved-stage" key={s.id}><h3>第 {i+1} 章 · {s.title}</h3><p>里程碑：{s.milestone || '旧计划未记录'}</p><p>成果检查点：{s.tasks.find(t=>t.id===s.checkpointTaskId)?.title ?? '旧计划未指定'}</p><ul>{s.tasks.map(t=><li key={t.id}><strong>{t.title}</strong><span>{t.status==='completed'?'已完成':t.progress?TASK_PROGRESS_LABELS[t.progress.status]:'待开始'} · {{light:'轻量',standard:'标准',challenge:'挑战'}[t.difficulty]} · {t.estimatedMinutes} 分钟 · {TASK_XP[t.difficulty]} XP</span><p className="task-instructions">{t.description}</p><p>完成标准：{t.doneCriteria}</p></li>)}</ul></section>)}</div>;
}
export function PlanConfirmation({ goal, dirty, onOpened }: { goal: Goal; dirty: boolean; onOpened: () => void }) {
  const { snapshot, save, saving, blocked } = useAppState();
  const [review,setReview]=useState<{revision:number;goal:string}|null>(null);
  const [focus,setFocus]=useState(false);const [message,setMessage]=useState('');const [pending,setPending]=useState(false);const [success,setSuccess]=useState<Goal|null>(null);const lock=useRef(false);
  const issues=planIssues(goal.draft!.content,true);
  const active=snapshot?.goals.filter(g=>g.status==='active')??[];const hours=active.reduce((n,g)=>n+g.weeklyHours,0);
  function preview(){setMessage('');if(dirty){setMessage('请先保存当前修改，再预览并开启冒险。');return;}setReview({revision:snapshot!.revision,goal:JSON.stringify(goal)});setFocus(false);}
  async function confirm(){if(!review||lock.current||saving||blocked||dirty)return;lock.current=true;setPending(true);setMessage('');try{let activated:Goal|undefined;const ok=await save(s=>{const next=activateGoal(s,goal.id,{...review,focus});activated=next.goals.find(g=>g.id===goal.id);return next;});if(ok&&activated){setSuccess(activated);onOpened();}else setMessage('保存失败，冒险尚未开启。原草稿保留，请检查存储提示后重试。');}catch(e){setMessage(e instanceof DomainError?e.message:'确认失败，请重试。');}finally{lock.current=false;setPending(false);}}
  if(success)return <section className="quest-card" role="status"><h2>冒险已开启！</h2><p>{success.title} · {success.confirmedPlan!.content.stages.length} 章 · {success.confirmedPlan!.content.stages.flatMap(s=>s.tasks).length} 项任务</p><p>{DIRECTIONS.find(d=>d.id===success.direction)?.name} · {snapshot?.focusGoalId===success.id?'当前重点主线':'未设为重点'} · 未发放 XP</p><div className="action-row"><Link href="/">返回冒险大厅</Link><Link href={`/goals/${success.id}`}>查看当前冒险</Link></div></section>;
  return <section className="quest-card confirmation-panel"><Button disabled={saving||blocked||pending} onClick={preview}>预览并开启冒险</Button>{message&&<p role="alert">{message}</p>}{review&&<><h2>确认你的成长旅程</h2><PlanContents goal={goal}/><p>计划确认后，将正式开启此成长目标。你可以暂停冒险；正式任务的修改需要经过受控修订流程。</p><div className="commitment-bar"><span>活跃名额 {active.length} / 3</span><span>当前每周合计 {hours} 小时</span><span>本目标 {goal.draft?.proposedWeeklyHours ?? goal.weeklyHours} 小时 · 开启后合计 {hours+(goal.draft?.proposedWeeklyHours ?? goal.weeklyHours)} 小时</span></div>{issues.length>0?<><h3>请先完善以下内容</h3><ul>{issues.map((i,n)=><li key={n}><button className="text-link" onClick={()=>{const el=document.getElementById(i.path);const details=el?.closest('details');if(details)details.open=true;el?.focus();}}>{i.message} · 返回定位修改</button></li>)}</ul></>:null}<label className="focus-choice"><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)} disabled={pending}/>设为当前重点冒险</label><p className="field-hint">{snapshot?.focusGoalId?'选择后将替换现有重点的展示优先级，其他主线保持活跃。':'可以选择重点，也可以暂不设置。'}确认不会授予 XP。</p>{active.length>=3&&<p role="alert">已有 3 条活跃冒险，请先主动暂停一条，再重新预览。</p>}<div className="action-row"><Button disabled={pending||saving||blocked||dirty||issues.length>0||active.length>=3} onClick={()=>void confirm()}>{pending?'正在开启…':'确认并开启冒险'}</Button><Button variant="outline" disabled={pending} onClick={()=>setReview(null)}>返回编辑</Button></div></>}</section>;
}
