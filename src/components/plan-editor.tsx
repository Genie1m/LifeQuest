"use client";
import Link from "next/link";
import { AIPlanning } from "./ai-planning";
import {RevisionStart,RevisionConfirmation} from './revision-controls';
import {saveRevision} from '@/domain/revision';
import { PlanConfirmation, PlanContents } from "./plan-confirmation";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/state/AppProvider";
import { DomainError } from "@/domain/commands";
import { editGoal, planIssues, savePlan } from "@/domain/editor";
import { DIRECTIONS } from "@/domain/catalog";
import type { Goal, PlanContent, Stage, Task } from "@/domain/types";
import { Button } from "./ui/button";
import { PageHeading } from "./quest-ui";
import { PlanEstimate } from "./plan-estimate";
import { RECOMMENDED_SESSION_MINUTES } from "@/domain/plan-quality";

export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    let allowedLink = false;
    const navigate = (e: Event) => { if (allowedLink) { allowedLink = false; return; } if (e.cancelable && !window.confirm("有未保存的修改，确定离开并放弃吗？")) e.preventDefault(); };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a[href]");
      if (!a || a.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("有未保存的修改，确定离开并放弃吗？")) { e.preventDefault(); e.stopImmediatePropagation(); }
      else allowedLink = true;
    };
    window.addEventListener("beforeunload", unload);
    nav?.addEventListener("navigate", navigate); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); nav?.removeEventListener("navigate", navigate); document.removeEventListener("click", click, true); };
  }, [dirty]);
}
function move<T>(items: T[], index: number, step: number) { const next = [...items]; const to = index + step; if (to < 0 || to >= items.length) return next; [next[index], next[to]] = [next[to], next[index]]; return next; }
export function GoalEditor({ id, metadata = false }: { id: string; metadata?: boolean }) {
  const [opened,setOpened] = useState<string | null>(null);
  const { snapshot } = useAppState(); const goal = snapshot?.goals.find(g => g.id === id);
  if (!goal) return <p>未找到目标。<Link href="/goals">返回冒险日志</Link></p>;
  if(goal.draft?.replan)return <section className="quest-card"><h1>时间预算重规划草稿</h1><p>原正式计划仍生效，请在专用入口审核预算与任务变化。</p><Button asChild><Link href={`/goals/${id}/replan`}>继续时间预算重规划 →</Link></Button></section>;
  if (opened === id && goal.status === "active") return <section className="quest-card" role="status"><h1>冒险已开启！</h1><h2>{goal.title}</h2><p>{goal.confirmedPlan!.content.stages.length} 章 · {goal.confirmedPlan!.content.stages.flatMap(s=>s.tasks).length} 项任务 · {DIRECTIONS.find(d=>d.id===goal.direction)?.name}</p><p>{snapshot?.focusGoalId===id?"当前重点主线":"未设为重点"} · 没有发放 XP</p><div className="action-row"><Link href="/">返回冒险大厅</Link><Link href={`/goals/${id}`}>查看当前冒险</Link></div></section>;
  if(['active','paused'].includes(goal.status)&&!metadata){if(goal.draft)return <Editor key={`${id}-revision`} goal={goal} metadata={false} revisionMode onOpened={()=>{}}/>;return <><PageHeading eyebrow="REVIEWED PLAN" title={goal.title}>正式版本 {goal.confirmedPlan!.revision} · 成果与经验保留</PageHeading><Button asChild><Link href={`/goals/${id}#tasks`}>进入行动地图 · 记录完成与XP</Link></Button><RevisionStart goal={goal}/><section className="quest-card"><PlanContents goal={goal}/></section></>;}
  if (goal.status !== "draft") return <><PageHeading eyebrow="READ ONLY" title={goal.title}>已激活、暂停及完成目标的资料只读，不能修改正式历史。</PageHeading><Link href={`/goals/${id}`}>返回目标</Link>{goal.status!=='completed'&&<Link href={`/goals/${id}/plan`}>前往章节计划创建 AI 修订</Link>}{!metadata && <section className="quest-card"><PlanContents goal={goal}/></section>}</>;
  return <Editor key={`${id}-${metadata}`} goal={goal} metadata={metadata} onOpened={()=>setOpened(id)} />;
}
function Editor({ goal, metadata, onOpened,revisionMode=false }: { goal: Goal; metadata: boolean; onOpened: () => void;revisionMode?:boolean }) {
  const { save, saving, blocked } = useAppState();
  const [base, setBase] = useState(goal);
  const [values, setValues] = useState({ title: goal.title, successCriteria: goal.successCriteria, baseline: goal.baseline, direction: goal.direction as string, weeklyHours: String(goal.weeklyHours) });
  const [content, setContent] = useState<PlanContent>(() => structuredClone(goal.draft!.content));
  const [message, setMessage] = useState(""); const [overview, setOverview] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
  const [splitFocus, setSplitFocus] = useState<string | null>(null);
  useEffect(() => { if (splitFocus) document.getElementById(splitFocus)?.focus(); }, [splitFocus]);
  const lock = useRef(false); const [pending, setPending] = useState(false);
  const initialValues = { title: base.title, successCriteria: base.successCriteria, baseline: base.baseline, direction: base.direction, weeklyHours: String(base.weeklyHours) };
  const dirty = metadata ? JSON.stringify(values) !== JSON.stringify(initialValues) : JSON.stringify(content) !== JSON.stringify(base.draft!.content);
  useLeaveWarning(dirty);
  const disabled = saving || blocked || pending;
  const issues = planIssues(content); const count = content.stages.reduce((n,s) => n + s.tasks.length, 0);
  function updateStage(id: string, update: (s: Stage) => Stage) { setContent(c => ({ stages: c.stages.map(s => s.id === id ? update(s) : s) })); setMessage(""); }
  function updateTask(stage: Stage, id: string, patch: Partial<Task>) { updateStage(stage.id, s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) })); }
  function splitTask(stage: Stage, index: number) {
    if (count >= 50) return;
    const id = crypto.randomUUID();
    const task: Task = { id, title: "", description: "", doneCriteria: "", estimatedMinutes: NaN, difficulty: "standard", status: "pending" };
    updateStage(stage.id, s => ({ ...s, tasks: [...s.tasks.slice(0, index + 1), task, ...s.tasks.slice(index + 1)] }));
    setSplitFocus(id);
    setMessage("已在原任务后插入一项。请为两项任务分别填写行动、估时和完成标准，再核对章节检查点。");
  }
  function removeTask(stage: Stage, task: Task, cancel = false) {
    if (!cancel && !window.confirm(`删除任务“${task.title || "未命名任务"}”？此操作在保存后生效。`)) return;
    const original = base.draft!.content.stages.find(s => s.id === stage.id)?.tasks.find(t => t.id === task.id);
    updateStage(stage.id, s => {
      const next = { ...s, tasks: cancel && original ? s.tasks.map(t => t.id === task.id ? structuredClone(original) : t) : s.tasks.filter(t => t.id !== task.id) };
      if (!next.tasks.some(t => t.id === next.checkpointTaskId)) delete next.checkpointTaskId;
      return next;
    });
    setMessage(cancel ? "任务已恢复为上次保存的内容；未保存的新任务已移除。" : "任务已移除；若它是检查点，请重新选择成果任务。");
  }
  async function persist() {
    if (lock.current || disabled) return; lock.current = true; setPending(true); setMessage(""); setErrors({});
    if (!metadata) { const invalid = planIssues(content, false); if (invalid.length) { setMessage(invalid[0].message); setErrors(Object.fromEntries(invalid.map(i => [i.path, i.message]))); const target = document.getElementById(invalid[0].path); const parent = target?.closest("details"); if (parent) parent.open = true; target?.focus(); lock.current = false; setPending(false); return; } }
    let candidate: Goal | undefined;
    try {
      const ok = await save(s => {
        const current = s.goals.find(g => g.id === goal.id);
        if (JSON.stringify(current) !== JSON.stringify(base)) throw new DomainError("invalid-input", "此目标在编辑期间已变化，请先保留输入并重新打开，避免覆盖较新内容。");
        const next = metadata ? editGoal(s, goal.id, { ...values, weeklyHours: Number(values.weeklyHours) }) : revisionMode?saveRevision(s,goal.id,content):savePlan(s, goal.id, content);
        candidate = next.goals.find(g => g.id === goal.id); return next;
      });
      if (ok && candidate) { setBase(candidate); if (metadata) setValues({ title: candidate.title, successCriteria: candidate.successCriteria, baseline: candidate.baseline, direction: candidate.direction, weeklyHours: String(candidate.weeklyHours) }); setMessage("已保存。刷新后可继续编辑。"); }
      else setMessage("保存失败，输入仍保留。请检查上方存储提示后重试。");
    } catch (e) { if (e instanceof DomainError) { setMessage(e.message); setErrors(e.fields); const key = Object.keys(e.fields)[0]; if (key) document.getElementById(key)?.focus(); } else setMessage("保存失败，输入已保留。"); }
    finally { lock.current = false; setPending(false); }
  }
  function cancel() { if (dirty && !window.confirm("取消修改并恢复到上次保存的内容？")) return; setContent(structuredClone(base.draft!.content)); setValues(initialValues); setErrors({}); setMessage("已恢复上次保存的内容。"); }
  return <div className="plan-editor"><Link className="text-link" href="/goals">← 返回冒险日志</Link><PageHeading eyebrow={revisionMode?"REVISION / 修订草稿":"DRAFT / 规划中"} title={metadata ? "编辑目标资料" : goal.title}>由你决定现实行动。{dirty ? "有未保存修改" : "与已保存内容一致"} · 不会自动激活或产生 XP</PageHeading>
    <div className="action-row"><Link className="text-link" href={`/goals/${goal.id}/${metadata ? "plan" : "edit"}`}>{metadata ? "编辑章节计划" : "编辑目标资料"}</Link><Link className="text-link" href={`/goals/${goal.id}`}>返回目标详情</Link></div>
    {revisionMode&&<p className="local-notice">正在编辑修订草稿。原正式计划仍生效；已有进展或成果的章节整体保留。生成只替换尚无进展或成果的章节，不改变最终成功标准。</p>}
    {metadata&&<Link className="text-link" href={`/goals/${goal.id}/plan`}>保存目标资料后，前往章节计划使用 AI →</Link>}
    {!metadata && <AIPlanning goal={base} revisionMode={revisionMode} dirty={dirty} disabled={disabled} onImport={next=>{setContent(next);setErrors({});setMessage("建议已导入编辑器，请审核后明确保存。");}}/>}
    <fieldset disabled={disabled} className="editor-fields">
    {metadata ? <section className="quest-card creation-form">{([['title','目标名称',80],['successCriteria','成功标准',500],['baseline','当前基础',500]] as const).map(([key,label,max]) => <label className="field" key={key}>{label}<textarea id={key} rows={key === 'title' ? 1 : 3} value={values[key]} maxLength={max} aria-invalid={!!errors[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} />{errors[key] && <span className="field-error">{errors[key]}</span>}</label>)}<label className="field">成长方向<select id="direction" value={values.direction} onChange={e => setValues(v => ({ ...v, direction: e.target.value }))}>{DIRECTIONS.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label className="field">每周投入时间（小时）<input id="weeklyHours" type="number" value={values.weeklyHours} onChange={e => setValues(v => ({ ...v, weeklyHours: e.target.value }))} />{errors.weeklyHours && <span className="field-error">{errors.weeklyHours}</span>}</label></section>
    : <><p className="local-notice">任务标题回答“我要做什么”；完成标准回答“做到什么程度算完成”。请写出数量、可交付结果或可观察的证据，系统不替你判定达标。</p><p>{content.stages.length} 个章节 · {count} 项草稿任务</p><PlanEstimate tasks={content.stages.flatMap(s=>s.tasks)} weeklyHours={goal.weeklyHours} label={revisionMode?"修订章节工作量":"草稿工作量"}/>
      {!content.stages.length && <section className="quest-card"><h2>还没有制定冒险计划</h2><p>先添加第一章，并为它设置可以完成的行动任务。</p></section>}
      {content.stages.map((s, index) => <details open className="quest-card editor-stage" key={s.id}><summary>第 {index + 1} 章 · {s.title || "等待命名"} · {s.tasks.length} 项任务</summary><div className="action-row"><Button variant="outline" disabled={index === 0} onClick={() => setContent(c => ({ stages: move(c.stages,index,-1) }))}>上移章节</Button><Button variant="outline" disabled={index === content.stages.length-1} onClick={() => setContent(c => ({ stages: move(c.stages,index,1) }))}>下移章节</Button><Button variant="ghost" onClick={() => { if (window.confirm(`删除章节及其中 ${s.tasks.length} 项任务？`)) setContent(c => ({ stages: c.stages.filter(x => x.id !== s.id) })); }}>删除章节</Button></div>
        <label className="field">章节名称<input id={s.id} value={s.title} onChange={e => updateStage(s.id, x => ({ ...x, title: e.target.value }))} aria-invalid={!!errors[s.id]} /></label><label className="field">阶段里程碑<textarea value={s.milestone} onChange={e => updateStage(s.id, x => ({ ...x, milestone: e.target.value }))} /></label>
        {s.tasks.map((t, ti) => <section className="editor-task" key={t.id}><h3>行动 {ti+1}</h3>{t.estimatedMinutes>RECOMMENDED_SESSION_MINUTES&&<p className="field-hint">这项任务预计超过一小时。如果要交付多个成果，可分开安排。</p>}<label className="field">真实任务标题<input id={t.id} value={t.title} aria-invalid={!!errors[t.id]} onChange={e => updateTask(s,t.id,{ title: e.target.value })} /></label><label className="field">任务说明<textarea value={t.description} onChange={e => updateTask(s,t.id,{ description: e.target.value })} /></label><label className="field">完成标准<textarea value={t.doneCriteria} placeholder="写下可以核对的具体结果，而不只是‘学习一下’" onChange={e => updateTask(s,t.id,{ doneCriteria: e.target.value })} /></label><div className="editor-columns"><label className="field">预计投入（分钟）<input type="number" min="5" max="600" step="1" value={Number.isNaN(t.estimatedMinutes) ? '' : t.estimatedMinutes} onChange={e => updateTask(s,t.id,{ estimatedMinutes: e.target.value === '' ? NaN : Number(e.target.value) })} /></label><label className="field">难度<select value={t.difficulty} onChange={e => updateTask(s,t.id,{ difficulty: e.target.value as Task['difficulty'] })}><option value="light">轻量</option><option value="standard">标准</option><option value="challenge">挑战</option></select></label></div>{errors[t.id] && <p className="field-error">{errors[t.id]}</p>}<div className="action-row"><Button variant="outline" disabled={ti === 0} onClick={() => updateStage(s.id,x => ({ ...x, tasks: move(x.tasks,ti,-1) }))}>上移任务</Button><Button variant="outline" disabled={ti === s.tasks.length-1} onClick={() => updateStage(s.id,x => ({ ...x, tasks: move(x.tasks,ti,1) }))}>下移任务</Button><Button variant="outline" disabled={count >= 50} onClick={() => splitTask(s,ti)} aria-label={`拆分任务：${t.title || "未命名任务"}`}>拆分任务</Button><Button variant="ghost" onClick={() => removeTask(s,t)}>删除任务</Button><Button variant="ghost" onClick={() => removeTask(s,t,true)}>取消任务修改</Button></div></section>)}
        <Button variant="outline" disabled={count >= 50} onClick={() => updateStage(s.id,x => ({ ...x,tasks:[...x.tasks,{ id:crypto.randomUUID(),title:'',description:'',doneCriteria:'',estimatedMinutes:30,difficulty:'standard',status:'pending' }] }))}>添加任务</Button><label className="field">章节成果检查点<select aria-label="章节成果检查点" value={s.checkpointTaskId ?? ''} onChange={e => updateStage(s.id,x => { const next={...x}; if(e.target.value)next.checkpointTaskId=e.target.value;else delete next.checkpointTaskId;return next; })}><option value="">尚未选择</option>{s.tasks.map(t => <option key={t.id} value={t.id}>{t.title || '未命名任务'}</option>)}</select><small>选择能核对里程碑的任务，通常是交付或复核的最后一步；本章所有任务完成后，章节才达成。</small></label>{errors[s.id] && <p className="field-error">{errors[s.id]}</p>}</details>)}
      <Button disabled={content.stages.length >= 10} onClick={() => setContent(c => ({ stages:[...c.stages,{ id:crypto.randomUUID(),title:'',milestone:'',tasks:[] }] }))}>{content.stages.length ? "新增章节" : "添加第一章"}</Button>
    </>}
    </fieldset>
    <div className="quest-card editor-save"><div className="action-row"><Button disabled={disabled} onClick={() => void persist()}>{pending ? "正在保存…" : metadata ? "保存目标资料" : "保存草稿"}</Button><Button disabled={disabled} variant="outline" onClick={cancel}>取消修改</Button>{!metadata && <Button variant="outline" onClick={() => setOverview(v => !v)}>查看计划概览</Button>}</div>{message && <p role="status">{message}</p>}</div>
    {!metadata && (revisionMode?<RevisionConfirmation goal={base} dirty={dirty}/>:<PlanConfirmation goal={base} dirty={dirty} onOpened={onOpened}/>)}
    {!metadata && overview && <section className="quest-card editor-overview"><h2>{revisionMode?"修订概览 · 尚未应用":"计划概览 · 尚未正式启动"}</h2><h3>{goal.title}</h3><p>{goal.successCriteria}</p><p>每周 {goal.weeklyHours} 小时 · {content.stages.length} 章 · {count} 项任务</p><PlanEstimate tasks={content.stages.flatMap(s=>s.tasks)} weeklyHours={goal.weeklyHours} label={revisionMode?"修订章节工作量":"草稿工作量"}/><p>概览包含当前未保存输入；只有保存成功后才会持久化。保存成功并补齐必要内容后，可预览并确认开启冒险。</p>{issues.length > 0 && <><h3>正式确认前需要补充</h3><ul>{issues.map((i,n) => <li key={n}><button className="text-link" onClick={() => { const el=document.getElementById(i.path); const details=el?.closest('details'); if(details)details.open=true;el?.focus(); }}>{i.message} · 定位修改</button></li>)}</ul></>}{content.stages.map((s,i) => <div key={s.id}><h3>第 {i+1} 章 · {s.title || '未命名'}</h3><p>里程碑：{s.milestone || '待填写'}</p><p>成果检查点：{s.tasks.find(t => t.id === s.checkpointTaskId)?.title || '待选择'}</p><ul>{s.tasks.map(t => <li key={t.id}>{t.title || '未命名任务'} — {t.doneCriteria || '待填写完成标准'}</li>)}</ul></div>)}</section>}
  </div>;
}
