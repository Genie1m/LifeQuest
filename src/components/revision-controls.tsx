"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {useAppState} from '@/state/AppProvider';
import {startRevision,discardRevision,confirmRevision,revisionContent,protectedStages} from '@/domain/revision';
import type {Goal} from '@/domain/types';
import {Button} from './ui/button';
import {PlanContents} from './plan-confirmation';
export function RevisionStart({goal}:{goal:Goal}){const {save,saving,blocked}=useAppState();const [message,setMessage]=useState('');const lock=useRef(false);async function start(){if(lock.current)return;lock.current=true;try{if(!await save(s=>startRevision(s,goal.id,JSON.stringify(goal))))setMessage('创建修订失败，正式计划未改变。');}catch(e){setMessage(e instanceof Error?e.message:'无法创建修订。');}finally{lock.current=false;}}
return <section className="quest-card"><h2>用 AI 或手动修改后续计划</h2><p>正式目标与成功标准保持不变。普通修订保留含进展或成果的章节；如果时间预算发生变化，可逐项重规划未完成任务。</p><div className="action-row"><Button disabled={saving||blocked} onClick={()=>void start()}>创建修订草稿并使用 AI</Button><Button asChild variant="outline"><Link href={`/goals/${goal.id}/replan`}>调整时间预算与任务范围 →</Link></Button></div>{message&&<p role="alert">{message}</p>}</section>;}
export function RevisionConfirmation({goal,dirty}:{goal:Goal;dirty:boolean}){
const {snapshot,save,saving,blocked}=useAppState();const [review,setReview]=useState<{revision:number;goal:string}|null>(null);const [message,setMessage]=useState('');const lock=useRef(false);
let candidate;let issue='';try{candidate=revisionContent(goal);}catch(e){issue=e instanceof Error?e.message:'修订未就绪。';}
async function apply(discard=false){if(lock.current||saving||blocked)return;lock.current=true;try{const ok=await save(s=>discard?discardRevision(s,goal.id,JSON.stringify(goal)):confirmRevision(s,goal.id,review!));if(!ok)setMessage('保存失败，正式计划未改变，修订草稿保留。');}catch(e){setMessage(e instanceof Error?e.message:'修订失败。');}finally{lock.current=false;}}
return <section className="quest-card confirmation-panel"><h2>修订正式计划</h2><p>当前正式版本 {goal.confirmedPlan!.revision}；保留 {protectedStages(goal).length} 个含进展或成果的章节。不改变目标成功标准、状态、重点和经验。</p><div className="action-row"><Button disabled={saving||blocked} onClick={()=>{if(dirty){setMessage('请先保存当前修改，再预览修订。');return;}setMessage('');setReview({revision:snapshot!.revision,goal:JSON.stringify(goal)});}}>预览修订差异</Button><Button variant="outline" disabled={saving||blocked} onClick={()=>{if(window.confirm('放弃全部修订草稿？正式计划与已有成果保持不变。'))void apply(true);}}>放弃修订草稿</Button></div>{message&&<p role="alert">{message}</p>}{review&&<><h3>原正式计划</h3><PlanContents goal={{...goal,draft:undefined}}/><h3>修订后的完整计划</h3>{issue?<p role="alert">{issue}</p>:<PlanContents goal={{...goal,confirmedPlan:{...goal.confirmedPlan!,content:candidate!},draft:undefined}}/>}<p>确认后仅替换尚无进展或成果的章节，正式版本加一；不会发 XP 或自动恢复暂停目标。</p><Button disabled={dirty||!!issue||saving||blocked} onClick={()=>void apply()}>确认应用修订</Button><Button variant="outline" onClick={()=>setReview(null)}>返回修改修订</Button></>}</section>;
}
