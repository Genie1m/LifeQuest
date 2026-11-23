import {estimateWork} from '@/domain/plan-estimates';

export function PlanEstimate({tasks, weeklyHours, label = '计划工作量'}: {
  tasks: ReadonlyArray<{estimatedMinutes: number}>;
  weeklyHours: number;
  label?: string;
}) {
  const estimate = estimateWork(tasks, weeklyHours);
  if (estimate.minutes === null) return <p>{label}：请先补齐有效的任务估时。</p>;
  return <p>{label}：{estimate.minutes} 分钟 · 每周可用 {estimate.weeklyMinutes} 分钟
    {estimate.minutes > 0 && <> · 按预算至少 {estimate.minimumWeeks} 周（未计返工和等待）</>}
  </p>;
}
