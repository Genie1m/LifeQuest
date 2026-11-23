import {proposalReview} from '@/domain/plan-quality';
import type {PlanProposal, PlanningInput} from '@/domain/proposal';
import {PlanEstimate} from './plan-estimate';

export function ProposalQualityReview({proposal, weeklyHours, mode = 'initial', input}: {
  proposal: PlanProposal;
  weeklyHours: number;
  mode?: 'initial' | 'chapters' | 'tasks';
  input?: Partial<PlanningInput>;
}) {
  const {tasks, issues, requirements, practiceWindowWeeks} = proposalReview(proposal, weeklyHours, mode, input);
  const label = mode === 'tasks' ? '所选任务工作量' : mode === 'chapters' ? '修订章节工作量' : '候选计划工作量';
  return <>
    <PlanEstimate tasks={tasks} weeklyHours={weeklyHours} label={label}/>
    {practiceWindowWeeks!==null&&<p>你要求实践或观察 {practiceWindowWeeks} 周。工作量推算的周数不包含这段必须经历的周期。</p>}
    {issues.length > 0 && <details open className="local-notice">
      <summary>请核对 {issues.length} 条质量提示</summary>
      <p>这些提示定位可能的问题，不代表内容评分。你可以导入编辑，或补充要求后重新生成；系统不会自动修改或发起下一次调用。</p>
      <ul>{issues.map((issue,i) => <li key={`${issue.code}-${issue.taskRef??i}`}><p>{issue.message}</p><p>{issue.suggestion}</p></li>)}</ul>
    </details>}
    {requirements.length > 0 && <details className="local-notice">
      <summary>对照本次需求检查成果</summary>
      <p>{mode==='initial'?'请在下面的章节和任务中核对每项要求是否有对应成果与验收。':'这里展示本次需求；当前候选仅修改允许范围，最终成果还需结合保留内容核对。'}文字或数量匹配不能代替实际验收。</p>
      <dl>{requirements.map(item=><div key={item.source}><dt><strong>{item.label}</strong></dt><dd className="task-instructions">{item.text}</dd></div>)}</dl>
      <p>核对顺序：成果是否齐全 → 每次行动能否做完 → 完成条件能否验证 → 检查点是否在必需工作之后。</p>
    </details>}
  </>;
}
