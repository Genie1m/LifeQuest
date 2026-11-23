import { draftFixture, completedFixture, stamp } from "./fixtures";
import type { AppSnapshot, Goal } from "@/domain/types";
export const uuid = (n: number) => `${n.toString(16).padStart(8, "0")}-1234-4234-8234-123456789abc`;
export function readyDraft(n: number): Goal {
  const goal = structuredClone(draftFixture().goals[0]);
  goal.id = uuid(n * 3); goal.title = `冒险 ${n}`;
  goal.draft!.content = { stages: [{ id: uuid(n * 3 + 1), title: `章节 ${n}`, milestone: "作品", tasks: [{ id: uuid(n * 3 + 2), title: `任务 ${n}`, description: "", doneCriteria: "交付真实作品", estimatedMinutes: 30, difficulty: "standard", status: "pending" }] }] };
  return goal;
}
export function activeFixture(count = 3): AppSnapshot {
  const data = draftFixture(); data.goals = [];
  for (let n = 1; n <= count; n++) {
    const goal = readyDraft(n);
    goal.status = "active"; goal.confirmedPlan = { revision: 1, confirmedAt: stamp, content: goal.draft!.content }; delete goal.draft;
    data.goals.push(goal);
  }
  return data;
}
export function v1Draft() { return { ...draftFixture(), schemaVersion: 1 as const }; }
export function v1Completed() { return { ...completedFixture(), schemaVersion: 1 as const }; }
