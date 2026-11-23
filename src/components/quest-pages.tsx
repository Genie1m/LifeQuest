"use client";
import Link from "next/link";
import { PlanContents } from "./plan-confirmation";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppState } from "@/state/AppProvider";
import { visualAvatar } from "@/domain/commands";
import type { Goal } from "@/domain/types";
import { DIRECTIONS } from "@/domain/catalog";
import { Button } from "./ui/button";
import { EmptyPanel, GoalSummary, PageHeading, RoleAvatar } from "./quest-ui";
import { GoalActions } from "./goal-actions";
import { CharacterPanel } from "./character/character-panel";
import {TaskBoard} from './task-board';
import {GrowthJournal} from './growth-journal';
import {goalProgress,TASK_XP} from '@/domain/execution';

const groups = [{ status: "active", title: "活跃冒险", note: "有正式计划，正在推进" }, { status: "draft", title: "规划中的冒险", note: "尚未确认正式计划，不占活跃名额" }, { status: "paused", title: "暂停的冒险", note: "计划和成果已保留，准备好时再出发" }, { status: "completed", title: "已完成档案", note: "真实走过的旅程，保留为只读记录" }] as const;
function NewAdventure() { return <Button asChild><Link href="/goals/new">创建新冒险</Link></Button>; }
function Commitment({ goals }: { goals: Goal[] }) {
  const active = goals.filter(g => g.status === "active");
  return <div className="commitment-bar"><span>活跃主线 <strong>{active.length} / 3</strong></span><span>每周合计 <strong>{active.reduce((sum, g) => sum + g.weeklyHours, 0)} 小时</strong></span><small>草稿和暂停不占活跃名额</small></div>;
}
function NextStep({ goal }: { goal: Goal }) {
  const {nextStage:stage,nextTask:task,done,total} = goalProgress(goal);
  const hasWaitingTasks = !task && done < total;
  return <section className="quest-card focus-quest"><span className="eyebrow">CURRENT FOCUS / 当前重点</span><h2>{goal.title}</h2>{stage && <><p>当前章节 · {stage.title}</p><p>里程碑：{stage.milestone || "旧计划未记录"}</p></>}<p>{done} / {total} 项任务完成</p>{task && <div className="next-task"><h3>下一步 · {task.title}</h3><p>完成标准：{task.doneCriteria}</p><span className="xp-chip">{task.estimatedMinutes} 分钟 · 完成可获 {TASK_XP[task.difficulty]} XP</span></div>}{hasWaitingTasks && <p>剩余任务均受阻或已推迟，可在行动地图恢复执行。</p>}{goal.draft && <p className="local-notice">这条冒险还有待确认的修订草稿。请前往完整计划，继续编辑并确认修订。</p>}<Button asChild><Link href={`/goals/${goal.id}#tasks`}>继续冒险 · 提交任务成果</Link></Button><GoalActions goal={goal} /></section>;
}
export function AdventureHall() {
  const { snapshot } = useAppState(); const params = useSearchParams(); const router = useRouter();
  if (!snapshot?.character) return null;
  const active = snapshot.goals.filter(g => g.status === "active");
  const drafts = snapshot.goals.filter(g => g.status === "draft").sort((a,b)=>(b.draft?.updatedAt??b.createdAt).localeCompare(a.draft?.updatedAt??a.createdAt));
  const paused = snapshot.goals.filter(g => g.status === "paused");
  const focus = active.find(g => g.id === snapshot.focusGoalId);
  return <>{params.get("welcome") === "1" && <section className="quest-card success-notice" role="status"><RoleAvatar id={visualAvatar(snapshot.character)} /><h2>角色创建成功</h2><p>欢迎，{snapshot.character.name}。从一个现实目标出发，让每次真实行动成为成长的足迹。</p><Button onClick={() => router.replace("/")}>进入冒险大厅</Button></section>}
    <PageHeading eyebrow="YOUR ADVENTURE / 你的冒险" title={`欢迎回来，${snapshot.character.name}`}>成长不是赶路，而是一步步成为你想成为的人。</PageHeading><CharacterPanel />
    <div className="section-heading quest-section"><h2>你的冒险路径</h2><Link className="text-link" href="/goals">查看全部目标 →</Link></div>
    {active.length > 0 ? <><Commitment goals={snapshot.goals} />{focus ? <NextStep goal={focus} /> : <div className="journal-intro"><h2>选择你当前的重点主线</h2><p>在下方活跃冒险中设为重点，下一步会在这里为你留好位置。切换不会改变任务或经验。</p></div>}<div className="journal-grid">{active.filter(g => g.id !== focus?.id).map(g => <GoalSummary key={g.id} goal={g} compact />)}</div><div className="quest-section"><NewAdventure /></div></>
    : drafts.length ? <><div className="journal-intro"><h2>你的冒险正在规划中。</h2><p>已有 {drafts.length} 条草稿。继续书写计划，或为另一个成长方向留下起点。</p><NewAdventure /></div><div className="journal-grid">{drafts.slice(0,1).map(g => <GoalSummary key={g.id} goal={g} compact />)}</div></>
    : paused.length ? <><div className="journal-intro"><h2>你的冒险暂时休整中</h2><p>准备好时恢复一条冒险，或开启新的目标。</p><NewAdventure /></div><div className="journal-grid">{paused.map(g => <GoalSummary key={g.id} goal={g} compact />)}</div></>
    : snapshot.goals.length ? <><GoalSummary goal={[...snapshot.goals].sort((a,b)=>(b.completedAt??b.createdAt).localeCompare(a.completedAt??a.createdAt))[0]}/><EmptyPanel title="走过的旅程，已收入档案" href="/goals/new" action="创建新冒险">已完成目标保留在冒险日志中，下一场冒险由你决定。</EmptyPanel></>
    : <EmptyPanel title="你的第一场冒险，尚待开启" href="/goals/new" action="开启第一场冒险">从一个真正想完成的现实目标开始。明确终点，也看见每一步与你成长的联系。</EmptyPanel>}
  </>;
}
export function GoalsPage() {
  const { snapshot } = useAppState(); if (!snapshot) return null;
  return <><PageHeading eyebrow="QUEST JOURNAL / 冒险日志" title="我的成长冒险">把生活中的不同方向，写成各自清晰的旅程。一次专注一步，也为其他愿望保留空间。</PageHeading><div className="journal-toolbar"><NewAdventure /><Link className="text-link" href="/">返回冒险大厅 →</Link></div><Commitment goals={snapshot.goals} />
    <nav className="journal-index" aria-label="冒险状态分区">{groups.map(group => <a key={group.status} href={`#quests-${group.status}`}>{group.title}<span>{snapshot.goals.filter(g => g.status === group.status).length}</span></a>)}</nav>
    {groups.map(group => { const goals = snapshot.goals.filter(g => g.status === group.status); return <section className="journal-section" id={`quests-${group.status}`} key={group.status} aria-labelledby={`title-${group.status}`}><div className="section-heading"><h2 id={`title-${group.status}`}>{group.title} <span className="section-count">{goals.length}</span></h2></div>{goals.length ? <><p className="field-hint">{group.note}</p><div className="journal-grid">{goals.map(goal => <div key={goal.id}>{snapshot.focusGoalId === goal.id && <p className="focus-label">当前重点主线</p>}<GoalSummary goal={goal} /></div>)}</div></> : <p className="compact-empty">暂无{group.title}。{group.status === "active" ? "保存计划后，进入预览并明确确认即可开启冒险。" : ""}</p>}</section>; })}</>;
}
export function GoalDetail({ id, plan = false }: { id: string; plan?: boolean }) {
  const { snapshot } = useAppState(); const goal = snapshot?.goals.find(item => item.id === id);
  if (!goal) return <><PageHeading eyebrow="QUEST NOT FOUND" title="未找到这个目标" /><EmptyPanel title="这条冒险记录暂时不存在" href="/goals" action="返回目标列表">请检查链接，或返回列表查看当前浏览器保存的目标。已有数据不会被修改。</EmptyPanel></>;
  return <><Link href="/goals" className="text-link">← 返回目标列表</Link><PageHeading eyebrow={plan ? "PLAN DRAFT / 计划草稿" : "QUEST DETAILS / 目标档案"} title={goal.title}>{{ draft: "规划中 · 尚未确认执行", active: "活跃 · 用真实行动推进冒险", paused: "已暂停 · 计划与历史保留", completed: "已完成 · 只读记录" }[goal.status]}</PageHeading>
    <section className="quest-card"><dl className="goal-facts"><div><dt>成功标准</dt><dd>{goal.successCriteria}</dd></div><div><dt>当前基础</dt><dd>{goal.baseline}</dd></div><div><dt>成长方向</dt><dd>{DIRECTIONS.find(d => d.id === goal.direction)?.name}</dd></div><div><dt>每周投入</dt><dd>{goal.weeklyHours} 小时</dd></div></dl>{!plan && goal.draft && <Button asChild><Link href={`/goals/${goal.id}/plan`}>继续规划冒险</Link></Button>}{plan && <Link className="text-link" href={`/goals/${goal.id}`}>查看目标详情 →</Link>}{goal.status === "draft" && <Link className="text-link" href={`/goals/${goal.id}/edit`}>编辑目标资料</Link>}<GoalActions goal={goal} /></section>
    {['active','paused'].includes(goal.status)&&<p className="quest-section"><Link className="text-link" href={`/goals/${goal.id}/replan`}>{goal.draft?.replan?'继续时间预算重规划 →':'调整时间预算与任务范围 →'}</Link></p>}
    {goal.confirmedPlan && <div className="quest-section" id="tasks"><TaskBoard goalId={goal.id}/><Link href={`/goals/${goal.id}/plan`} className="text-link">{goal.status==='completed'?'查看完整计划 →':'查看完整计划／AI 修订 →'}</Link></div>}
    {!goal.confirmedPlan&&goal.draft&&<section className="quest-card quest-section"><PlanContents goal={goal}/></section>}
    <p className="scope-note">真实任务完成后才结算经验；查看、规划和修订不会产生 XP。{goal.status === "paused" && "暂停期间可创建修订，确认后仍保持暂停。"}</p></>;
}
export function CharacterPage() {
  return <><PageHeading eyebrow="CHARACTER / 冒险者档案" title="每一次成长，都属于你">五种方向，一条由你决定的成长路径。</PageHeading><CharacterPanel full /><GrowthJournal/></>;
}
