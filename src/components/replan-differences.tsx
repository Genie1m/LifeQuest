import {taskChanges} from '@/domain/replan';
import type {Goal,PlanContent} from '@/domain/types';
export function ReplanDifferences({goal,content}:{goal:Goal;content:PlanContent}){
 const changes=taskChanges(goal,content);const modified=changes.filter(c=>JSON.stringify(c.before)!==JSON.stringify(c.after));
 return <div><p className="local-notice">任务内容修改 {modified.length} 项 · 本周期暂不安排 {changes.filter(c=>c.deferred).length} 项。预算或安排变化，不代表任务内容已经改变。</p>{!modified.length&&<p>任务内容尚未改变。如果你希望调整练习量、步骤或验收标准，请先生成AI建议并采用，或展开手动编辑。也可以只更新预算和安排。</p>}{changes.map(c=>{const edited=JSON.stringify(c.before)!==JSON.stringify(c.after);return <article key={c.before.id}><h3>{c.before.title}</h3>{c.deferred?<p>本周期暂不安排，保留到后续；没有完成或删除。</p>:c.previouslyDeferred?<p>重新纳入本周期。</p>:null}{!edited?<p>内容与预计时长均未变，仅调整执行安排。</p>:<dl className="replan-field-diff">{([['title','任务范围'],['description','行动步骤'],['estimatedMinutes','预计分钟'],['doneCriteria','完成标准']] as const).filter(([key])=>c.before[key]!==c.after[key]).map(([key,label])=><div key={key}><dt>{label}</dt><dd><span>原内容</span><p>{c.before[key]}</p><span>修改后</span><p>{c.after[key]}</p></dd></div>)}</dl>}</article>;})}</div>;
}
