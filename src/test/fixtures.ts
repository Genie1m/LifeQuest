import { emptySnapshot, type AppSnapshot } from "@/domain/types";
export const stamp = "2026-10-20T02:00:00.000Z";
export const ids = {
  profile: "11111111-1111-4111-8111-111111111111",
  character: "22222222-2222-4222-8222-222222222222",
  goal: "33333333-3333-4333-8333-333333333333",
  stage: "44444444-4444-4444-8444-444444444444",
  task: "55555555-5555-4555-8555-555555555555",
};
// Test-only records; never imported by application routes or seeded into user storage.
export function draftFixture(): AppSnapshot {
  return {
    ...emptySnapshot(), revision: 3,
    profile: { id: ids.profile, createdAt: stamp },
    character: { id: ids.character, profileId: ids.profile, name: "测试角色", avatarId: "compass", createdAt: stamp },
    goals: [{ id: ids.goal, characterId: ids.character, title: "测试目标", successCriteria: "交付作品", direction: "creativity", baseline: "初学", weeklyHours: 5, status: "draft", createdAt: stamp,
      draft: { baseRevision: 0, source: "manual", updatedAt: stamp, content: { stages: [] } } }],
  };
}
export function completedFixture(): AppSnapshot {
  const data = draftFixture(); const goal = data.goals[0];
  goal.status = "completed"; goal.completedAt = stamp; delete goal.draft;
  goal.confirmedPlan = { revision: 1, confirmedAt: stamp, content: { stages: [{ id: ids.stage, title: "阶段", milestone: "成果", tasks: [{ id: ids.task, title: "任务", description: "", doneCriteria: "完成成果", estimatedMinutes: 30, difficulty: "standard", status: "completed", completedAt: stamp }] }] } };
  data.completions = [{ taskId: ids.task, goalId: ids.goal, stageId: ids.stage, characterId: ids.character, direction: "creativity", xp: 40, difficulty: "standard", taskTitle: "任务", stageTitle: "阶段", completedAt: stamp }];
  return data;
}
