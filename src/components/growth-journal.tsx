"use client";
import Link from 'next/link';
import {Trophy} from 'lucide-react';
import {useAppState} from '@/state/AppProvider';
import {achievements} from '@/domain/execution';
import {DIRECTIONS} from '@/domain/catalog';

export function GrowthJournal(){
 const {snapshot}=useAppState();if(!snapshot?.character)return null;
 const entries=[...snapshot.completions].sort((a,b)=>b.completedAt.localeCompare(a.completedAt));
 return <section className="growth-journal quest-section"><div className="section-heading"><h2>旅程中的里程碑</h2><span>成就不额外发放XP</span></div><div className="achievement-grid">{achievements(snapshot).map(a=><section className={`quest-card achievement ${a.unlocked?'achievement-earned':''}`} key={a.id}><Trophy aria-hidden="true"/><span className="eyebrow">{a.unlocked?'已解锁':'未解锁'}</span><h3>{a.title}</h3><p>{a.description}</p></section>)}</div><div className="section-heading quest-section"><h2>我的成长足迹</h2><span>{entries.length} 项真实完成记录</span></div>{entries.length?<ol className="growth-entries">{entries.map(e=><li className="quest-card" key={e.taskId}><span className="xp-chip">+{e.xp} XP · {DIRECTIONS.find(d=>d.id===e.direction)?.name}</span><h3>{e.taskTitle}</h3><p>{e.stageTitle} · {new Date(e.completedAt).toLocaleString('zh-CN')}</p>{e.note&&<p className="task-instructions">成果记录：{e.note}</p>}<Link className="text-link" href={`/goals/${e.goalId}`}>回到来源冒险 →</Link></li>)}</ol>:<section className="quest-card"><h3>第一份成果，等你写下</h3><p>在活跃冒险里完成一项真实任务并确认后，经验与成果会一起记在这里。</p><Link href="/goals" className="text-link">前往我的冒险 →</Link></section>}</section>;
}
