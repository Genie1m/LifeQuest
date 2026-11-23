import type { PlanContent } from "./types";
export interface PlanIssue { path: string; message: string }
/** Shared readiness rules for the overview and future Step 4B confirmation. */
export function planIssues(content: PlanContent, ready = true): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (content.stages.length > 10 || (ready && !content.stages.length)) add("plan", "计划需要 1～10 个章节。");
  const ids = new Set<string>(); let count = 0;
  for (const s of content.stages) {
    if (ids.has(s.id)) add(s.id, "章节或任务 ID 重复。"); ids.add(s.id);
    if (!s.title.trim() || s.title.length > 80) add(s.id, "章节名称须为 1～80 字。");
    if (s.milestone.length > 500 || (ready && !s.milestone.trim())) add(s.id, "请填写 500 字以内的章节里程碑。");
    if (ready && !s.tasks.length) add(s.id, "章节至少需要一项任务。");
    if (s.checkpointTaskId && !s.tasks.some(t => t.id === s.checkpointTaskId)) add(s.id, "成果检查点必须属于本章节。");
    if (ready && !s.checkpointTaskId) add(s.id, "请选择章节成果检查点。");
    for (const t of s.tasks) {
      count++;
      if (ids.has(t.id)) add(t.id, "章节或任务 ID 重复。"); ids.add(t.id);
      if (!t.title.trim() || t.title.length > 80) add(t.id, "任务标题须为 1～80 字。");
      if (!t.doneCriteria.trim() || t.doneCriteria.length > 500) add(t.id, "完成标准须为 1～500 字。");
      if (t.description.length > 500) add(t.id, "任务说明不能超过 500 字。");
      if (!Number.isInteger(t.estimatedMinutes) || t.estimatedMinutes < 5 || t.estimatedMinutes > 600) add(t.id, "预计投入须为 5～600 的整数分钟。");
      if (!["light", "standard", "challenge"].includes(t.difficulty) || t.status !== "pending" || t.completedAt !== undefined || t.progress !== undefined) add(t.id, "草稿任务必须待完成，难度须为合法选项。");
    }
  }
  if (count > 50) add("plan", "计划最多 50 项任务。");
  return issues;
}
