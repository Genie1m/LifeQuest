"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {Check,Flag,Sparkles,Trophy} from 'lucide-react';
import {useAppState} from '@/state/AppProvider';
import {DomainError,visualAvatar} from '@/domain/commands';
import {completeTask,goalProgress,recordTaskProgress,stageProgress,TASK_XP,type CompletionReceipt} from '@/domain/execution';
import {DIRECTIONS} from '@/domain/catalog';
import {TASK_PROGRESS_LABELS,type Task,type TaskProgressStatus} from '@/domain/types';
import {CharacterArtwork} from './character/artwork';
import {Button} from './ui/button';
import {PlanEstimate} from './plan-estimate';

export function TaskBoard({goalId}:{goalId:string}){
 const {snapshot,save,saving,blocked}=useAppState();const goal=snapshot?.goals.find(g=>g.id===goalId);
 const [selection,setSelection]=useState<{task:Task;goal:string;mode:'complete'|'progress'}|null>(null);const [note,setNote]=useState('');const [checked,setChecked]=useState(false);const [message,setMessage]=useState('');const [receipt,setReceipt]=useState<CompletionReceipt|null>(null);
 const [status,setStatus]=useState<TaskProgressStatus|'pending'>('in-progress');
 const [progressMessage,setProgressMessage]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);const reward=useRef<HTMLElement>(null);const lock=useRef(false);const trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{if(selection)dialog.current?.showModal();},[selection]);
 useEffect(()=>{if(receipt)reward.current?.focus();},[receipt]);
 function close(){dialog.current?.close();setSelection(null);trigger.current?.focus();}
 function open(task:Task,button:HTMLButtonElement,mode:'complete'|'progress'='complete'){
  trigger.current=button;setSelection({task,goal:JSON.stringify(goal),mode});
  setStatus(task.progress?.status??'in-progress');setNote(mode==='progress'?(task.progress?.note??''):'');setChecked(false);setMessage('');setProgressMessage('');
 }
 async function saveProgress(){
  if(!selection||selection.mode!=='progress'||lock.current||saving||blocked)return;
  lock.current=true;
  setMessage('');
  try{
   const ok=await save(current=>recordTaskProgress(current,goalId,selection.task.id,selection.goal,status,note));
   if(ok){setProgressMessage(`已保存「${selection.task.title}」的进展。完成数和 XP 未变化。`);setReceipt(null);close();}
   else setMessage('保存失败，备注已保留，可以重试。');
  }catch(e){setMessage(e instanceof Error?e.message:'保存进展失败，请重新打开任务。');}
  finally{lock.current=false;}
 }
 async function confirm(){
  if(!goal||!selection||selection.mode!=='complete'||lock.current||!checked||saving||blocked)return;lock.current=true;setMessage('');
  try{let result:CompletionReceipt|null=null;const ok=await save(current=>{const completion=completeTask(current,goalId,selection.task.id,{goal:selection.goal,confirmed:checked},note);if(!completion.receipt)throw new DomainError('invalid-input','这项任务已完成，不能重复领取经验。');result=completion.receipt;return completion.snapshot;});
   if(ok&&result){setReceipt(result);close();}else setMessage('保存失败：任务和XP均未提交。成果记录已保留，可以重试。');
  }catch(e){setMessage(e instanceof Error?e.message:'提交失败，请重新打开任务。');}finally{lock.current=false;}
 }
 if(!goal?.confirmedPlan||!snapshot?.character)return null;
 const progress=goalProgress(goal);const actionable=goal.status==='active'&&!goal.draft;
 const direction=DIRECTIONS.find(d=>d.id===goal.direction)!.name;
 return <section className="execution-board" aria-label="任务冒险地图">
  <div className="execution-overview quest-card"><div><span className="eyebrow">QUEST MAP / 行动地图</span><h2>{goal.status==='completed'?'冒险已完成':'让下一步，成为真实成果'}</h2><p>{progress.done} / {progress.total} 项任务 · {progress.completedStages} / {goal.confirmedPlan.content.stages.length} 章完成</p></div><strong className="quest-percent">{progress.percent}<small>%</small></strong><progress max={Math.max(1,progress.total)} value={progress.done} aria-label="目标任务完成进度"/><p className="field-hint">每项行动显示参考时长与可获XP。按推荐章节推进，也可自由选择任务；完成后需核对成果并确认。</p>
   <PlanEstimate tasks={goal.confirmedPlan.content.stages.flatMap(stage=>stage.tasks).filter(task=>task.status==='pending')} weeklyHours={goal.weeklyHours} label="目标剩余工作量"/>
   {!actionable&&goal.status!=='completed'&&<p className="local-notice">{goal.draft?'存在待确认修订：请先确认或放弃修订，再提交任务。':'冒险已暂停，恢复后即可记录完成。'} <Link href={`/goals/${goal.id}/plan`} className="text-link">查看计划 →</Link></p>}
  </div>
  {receipt&&<section ref={reward} tabIndex={-1} className={`quest-card reward-feedback ${receipt.levelAfter>receipt.levelBefore?'level-up':''}`} role="status" aria-label="本次成长反馈"><div className="reward-avatar"><CharacterArtwork avatarId={visualAvatar(snapshot.character)} kind="portrait"/></div><div><span className="eyebrow">REAL ACTION / 真实成长</span><h2>{receipt.levelAfter>receipt.levelBefore?`升级！Lv.${receipt.levelBefore} → Lv.${receipt.levelAfter}`:'又向前走了一步'}</h2><p>{receipt.taskTitle} · <strong>+{receipt.xp} XP</strong> · {direction} +{receipt.xp}</p>{receipt.stageCompleted&&<p><Flag size={16} aria-hidden="true"/> 章节达成！{receipt.goalCompleted?'这条冒险的全部任务已完成。':receipt.nextStageTitle?`下一步推荐 · ${receipt.nextStageTitle}`:'可在行动地图查看其余任务。'}</p>}{receipt.newAchievements.length>0&&<p><Trophy size={16} aria-hidden="true"/> 解锁成就：{receipt.newAchievements.join('、')}（不额外发XP）</p>}<Link href="/character" className="text-link">查看我的成长档案 →</Link></div><Button variant="ghost" onClick={()=>setReceipt(null)}>收起反馈</Button></section>}
  {progressMessage&&<p role="status">{progressMessage}</p>}
  {actionable&&!progress.nextTask&&<p className="local-notice">剩余任务均受阻或已推迟。准备好后，可在对应任务的「记录进展」中选择「进行中」。</p>}
  {goal.confirmedPlan.adjustment&&<p className="local-notice">当前周预算 {goal.weeklyHours} 小时 · 参考窗口 {goal.confirmedPlan.adjustment.windowWeeks} 周。后续清单中的任务仍计入目标完成进度。</p>}
  <nav className="chapter-route" aria-label="章节路线">{goal.confirmedPlan.content.stages.map((s,i)=>{const chapter=stageProgress(s);return <a key={s.id} href={`#stage-${s.id}`} aria-current={s.id===progress.nextStage?.id?'step':undefined}><span>{chapter.complete?<Check size={16} aria-hidden="true"/>:String(i+1).padStart(2,'0')}</span><strong>{s.title}</strong><small>{chapter.complete?'已达成':chapter.checkpointReached?'检查点已达成 · 章节未完成':s.id===progress.nextStage?.id?'推荐当前章节':'未完成 · 可自由探索'}</small></a>;})}</nav>
  {goal.confirmedPlan.content.stages.map((stage,index)=>{
   const chapter=stageProgress(stage);
   return <section key={stage.id} id={`stage-${stage.id}`} className={`quest-card execution-stage ${progress.nextStage?.id===stage.id?'stage-current':''}`} aria-label={`第${index+1}章任务`}>
    <div className="section-heading"><span className="eyebrow">CHAPTER {String(index+1).padStart(2,'0')}</span><span className="stage-badge">{chapter.complete?'章节已达成':`${chapter.done} / ${chapter.total}`}</span></div><h2>{stage.title}</h2><p>{stage.milestone||'按已确认任务推进这一章。'}</p>
    {chapter.checkpointReached&&!chapter.complete&&<p className="field-hint">检查点已达成。还有 {chapter.total-chapter.done} 项任务待完成。</p>}
    <PlanEstimate tasks={stage.tasks.filter(task=>task.status==='pending')} weeklyHours={goal.weeklyHours} label="本章剩余工作量"/>
    <progress max={chapter.total} value={chapter.done} aria-label={`第${index+1}章完成进度`}/>
    <ol className="execution-tasks">{stage.tasks.map((task,i)=><li key={task.id} className={task.status==='completed'?'task-complete':''}>
     <div className="task-number" aria-hidden="true">{task.status==='completed'?<Check size={20}/>:i+1}</div><div className="execution-task-copy"><div className="task-heading"><h3>{task.title}</h3><span className="xp-chip">{task.status==='completed'?'已获得':'完成可获'} {TASK_XP[task.difficulty]} XP</span></div><p className="task-meta">{task.status==='completed'?'已完成':task.progress?TASK_PROGRESS_LABELS[task.progress.status]:'待开始'} · {task.estimatedMinutes} 分钟 · {{light:'轻量',standard:'标准',challenge:'挑战'}[task.difficulty]}{stage.checkpointTaskId===task.id?' · 本章成果检查点':''}{goal.confirmedPlan!.adjustment?.deferredTaskIds.includes(task.id)?' · 预算后续清单':''}</p>{task.description&&<p className="task-instructions">{task.description}</p>}<div className="done-criteria"><strong>完成时交付什么</strong><p>{task.doneCriteria}</p></div>{task.progress?.note&&<p className="task-instructions"><strong>进展备注：</strong>{task.progress.note}</p>}{task.status==='pending'?<div className="action-row"><Button variant="outline" disabled={!actionable||saving||blocked} onClick={e=>open(task,e.currentTarget,'progress')} aria-label={`记录进展：${task.title}`}>记录进展</Button><Button variant="outline" disabled={!actionable||saving||blocked} onClick={e=>open(task,e.currentTarget)} aria-label={`标记完成：${task.title}`}><Check aria-hidden="true"/>标记完成</Button></div>:<p className="settled-note">已记入成长档案 · {new Date(task.completedAt!).toLocaleDateString('zh-CN')} · 经验仅结算一次</p>}</div>
    </li>)}</ol>
   </section>;
  })}
  <dialog className="completion-dialog" ref={dialog} aria-labelledby="completion-title" onCancel={event=>{if(saving)event.preventDefault();else close();}}>
   {selection?.mode==='progress'&&<>
    <h2 id="completion-title">记录任务进展</h2><h3>{selection.task.title}</h3>
    <label className="field">任务进展<select value={status} disabled={saving} onChange={e=>setStatus(e.target.value as typeof status)}>
     <option value="pending">重置为待开始（清除当前备注）</option>
     {Object.entries(TASK_PROGRESS_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}
    </select></label>
    {status!=='pending'&&<label className="field">{status==='blocked'?'受阻原因（必填）':'当前进展与下一步（可选）'}<textarea rows={3} maxLength={1000} value={note} disabled={saving} onChange={e=>setNote(e.target.value)}/></label>}
    <p className="field-hint">这份备注保存在本机。达到完成标准后，可另外提交成果并领取 XP。</p>
    {message&&<p role="alert">{message}</p>}
    <div className="action-row"><Button disabled={saving||blocked||(status==='blocked'&&!note.trim())} onClick={()=>void saveProgress()}>保存进展</Button><Button variant="outline" disabled={saving} onClick={close}>取消</Button></div>
   </>}
   {selection?.mode==='complete'&&<>
    <h2 id="completion-title">确认这一步已完成</h2><h3>{selection.task.title}</h3>
    <div className="done-criteria"><strong>请核对完成标准</strong><p>{selection.task.doneCriteria}</p></div>
    <label className="field">成果记录（可选，最多1000字）<textarea rows={3} maxLength={1000} value={note} disabled={saving} onChange={e=>setNote(e.target.value)} placeholder="记录真实交付物或核对结果。只保存在本机，不发送给模型。"/></label>
    <label className="completion-check"><input type="checkbox" autoFocus checked={checked} disabled={saving} onChange={e=>setChecked(e.target.checked)}/>我已执行任务，并核对实际结果符合以上完成标准。确认后不可撤销。</label>
    <p className="reward-caption"><Sparkles size={16} aria-hidden="true"/> 保存成功后获得 {TASK_XP[selection.task.difficulty]} XP，计入{direction}方向。</p>
    {message&&<p role="alert">{message}</p>}
    <div className="action-row"><Button disabled={!checked||saving||blocked} onClick={()=>void confirm()}>{saving?'正在保存…':'确认完成并记录成长'}</Button><Button variant="outline" disabled={saving} onClick={close}>继续任务，暂不提交</Button></div>
   </>}
  </dialog>
 </section>;
}
