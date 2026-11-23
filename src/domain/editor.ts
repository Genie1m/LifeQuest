import { planIssues } from "./plan-readiness";
export { planIssues } from "./plan-readiness";
import { DomainError, validateGoalInput, type GoalInput } from "./commands";
import type { AppSnapshot, PlanContent } from "./types";
import { parseSnapshot } from "./validation";

function editable(s: AppSnapshot, id: string) {
  parseSnapshot(s);
  const goal = s.goals.find(g => g.id === id);
  if (!goal || goal.status !== "draft" || !goal.draft) throw new DomainError("invalid-transition", "本轮仅允许编辑规划中的目标。");
  return goal;
}
export function editGoal(s: AppSnapshot, id: string, input: GoalInput): AppSnapshot {
  const goal = editable(s, id);
  const next = { ...goal, ...validateGoalInput(input) };
  return parseSnapshot({ ...s, goals: s.goals.map(g => g.id === id ? next : g) });
}
export function savePlan(s: AppSnapshot, id: string, content: PlanContent, now = new Date().toISOString()): AppSnapshot {
  const goal = editable(s, id); const issues = planIssues(content, false);
  if (issues.length) throw new DomainError("invalid-input", issues[0].message);
  try {
    return parseSnapshot({ ...s, goals: s.goals.map(g => g.id === id ? { ...goal, draft: { ...goal.draft!, content: structuredClone(content), updatedAt: now } } : g) });
  } catch { throw new DomainError("invalid-input", "计划包含无效标识或其他目标已使用的章节/任务，请检查后重试。"); }
}
