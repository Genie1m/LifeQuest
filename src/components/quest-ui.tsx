"use client";
import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { DIRECTIONS } from "@/domain/catalog";
import { planIssues } from "@/domain/editor";
import { useAppState } from "@/state/AppProvider";
import type { Goal } from "@/domain/types";
import { Button } from "./ui/button";

import { GoalActions } from "./goal-actions";
import { CharacterArtwork } from "./character/artwork";
export function RoleAvatar({ id }: { id: string }) {
  return <span className="role-avatar"><CharacterArtwork avatarId={id} kind="portrait" eager /></span>;
}
export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}
export function EmptyPanel({ title, children, href, action }: { title: string; children: ReactNode; href?: string; action?: string }) {
  return <section className="quest-card empty-panel"><span className="feature-icon"><Compass aria-hidden="true" /></span><h2>{title}</h2><p>{children}</p>{href && <Button asChild><Link href={href}>{action}</Link></Button>}</section>;
}
export const goalHref = (goal: Goal) => goal.status === "draft" ? `/goals/${goal.id}/plan` : `/goals/${goal.id}`;
export function GoalSummary({ goal, compact = false }: { goal: Goal; compact?: boolean }) {
  const { snapshot } = useAppState();
  const tasks = goal.confirmedPlan?.content.stages.flatMap(s=>s.tasks) ?? [];
  const done = tasks.filter(t=>t.status==='completed').length;
  const nextStage = goal.confirmedPlan?.content.stages.find(s=>s.tasks.some(t=>t.status==='pending'));
  const next = nextStage?.tasks.find(t=>t.status==='pending');
  const entries = snapshot?.completions.filter(e=>e.goalId===goal.id) ?? [];
  return <section className={`quest-card quest-state-${goal.status}`}><div className="section-heading"><span className="eyebrow">{DIRECTIONS.find(d=>d.id===goal.direction)?.name}</span><span className="stage-badge">{{draft:'规划中',active:'活跃',paused:'已暂停',completed:'已完成'}[goal.status]}</span></div><h2 className="wrap-text">{goal.title}</h2>{snapshot?.focusGoalId===goal.id&&<p className="focus-label">当前重点主线</p>}<p className="goal-summary">{goal.successCriteria}</p><p>每周投入 {goal.weeklyHours} 小时{goal.status==='paused'?'（原计划）':''}</p>{goal.status==='draft'?<><p>{goal.draft!.content.stages.length?`已规划 ${goal.draft!.content.stages.length} 章 · ${goal.draft!.content.stages.flatMap(s=>s.tasks).length} 个任务`:'尚未制定章节计划'}</p><p className="field-hint">{planIssues(goal.draft!.content,true).length?'继续完善章节、任务与成果检查点':'计划已准备就绪'}</p></>:<><p>{goal.confirmedPlan!.content.stages.length} 章 · {done} / {tasks.length} 项任务完成 · {tasks.length?Math.round(done/tasks.length*100):0}%</p>{goal.status==='active'&&!compact&&next&&<div className="next-task"><p>当前章节 · {nextStage!.title}</p><h3>下一步 · {next.title}</h3><p>{next.doneCriteria}</p></div>}{goal.status==='completed'&&<><p>完成时间：{goal.completedAt}</p>{entries.length>0&&<p>真实完成流水 {entries.length} 项 · {entries.reduce((n,e)=>n+e.xp,0)} XP</p>}</>}</>}<div className="action-row"><Button asChild><Link href={goalHref(goal)}>{goal.status==='draft'?'继续规划冒险':goal.status==='completed'?'查看成果档案':'查看当前冒险'}</Link></Button>{goal.status==='draft'?<Link href={`/goals/${goal.id}/edit`}>编辑目标资料</Link>:<Link href={`/goals/${goal.id}/plan`}>查看完整计划</Link>}<Link href={`/goals/${goal.id}`}>目标详情</Link></div><GoalActions goal={goal}/></section>;
}
