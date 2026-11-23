import { describe, it, expect } from "vitest";
import { createGoal, activateGoal as reviewedActivation, pauseGoal, resumeGoal, setFocusGoal, confirmCharacterClass, visualAvatar } from "./commands";
import { parseSnapshot } from "./validation";
import { characterGrowth } from "./progression";
import { draftFixture, completedFixture, stamp } from "@/test/fixtures";
import { activeFixture, readyDraft, uuid } from "@/test/multi-fixtures";
import { LocalStorageRepository, STORAGE_KEY } from "@/services/repository";

function activateGoal(s: Parameters<typeof reviewedActivation>[0], id: string, env?: Parameters<typeof reviewedActivation>[3]) { return reviewedActivation(s,id,{revision:s.revision,goal:JSON.stringify(s.goals.find(g=>g.id===id)),focus:false},env); }
describe("multiple independent adventures", () => {
  it("creates four drafts with unique IDs, independent plans, same XP and persisted reload", async () => {
    const original = completedFixture(); let data = original;
    for (let n = 1; n <= 4; n++) data = createGoal(data, { title: `目标 ${n}`, baseline: "初学", successCriteria: "作品", weeklyHours: 2, direction: "creativity" }, { id: () => uuid(100 + n), now: () => stamp });
    expect(data.goals).toHaveLength(5); expect(new Set(data.goals.map(g => g.id)).size).toBe(5);
    expect(data.goals[0]).toEqual(original.goals[0]); expect(data.completions).toEqual(original.completions);
    expect(data.goals[1].draft).not.toBe(data.goals[2].draft);
    expect(characterGrowth(data.character!.id, data.completions)).toEqual(characterGrowth(original.character!.id, original.completions));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(original));
    const repo = new LocalStorageRepository(); await repo.save({ ...data, revision: original.revision + 1 }, original.revision);
    expect((await repo.load())?.goals).toEqual(data.goals);
    expect(() => createGoal(data, { title: "重复", baseline: "初学", successCriteria: "作品", weeklyHours: 2, direction: "creativity" }, { id: () => data.goals[1].id, now: () => stamp })).toThrow();
  });
  it("rejects fourth activation and resume in domain; a pause releases a slot", () => {
    const data = activeFixture(); const fourth = readyDraft(4); fourth.draft!.content.stages[0].checkpointTaskId = fourth.draft!.content.stages[0].tasks[0].id; data.goals.push(fourth);
    const before = structuredClone(data);
    expect(() => activateGoal(data, fourth.id)).toThrow("3 条活跃"); expect(data).toEqual(before);
    const paused = pauseGoal(data, data.goals[0].id);
    const activated = activateGoal(paused, fourth.id, { id: () => uuid(99), now: () => stamp });
    expect(activated.goals.filter(g => g.status === "active")).toHaveLength(3);
    expect(() => resumeGoal(activated, data.goals[0].id)).toThrow("3 条活跃");
    const restored = resumeGoal(pauseGoal(activated, fourth.id), data.goals[0].id);
    expect(restored.goals[0]).toEqual(data.goals[0]);
    expect(restored.goals[1]).toEqual(data.goals[1]); expect(restored.completions).toEqual(data.completions);
  });
  it("preserves pending revisions while pausing and resuming, clears focus without auto-picking", () => {
    const data = activeFixture(2); const goal = data.goals[0];
    goal.draft = { baseRevision: 1, source: "manual", updatedAt: stamp, content: structuredClone(goal.confirmedPlan!.content) };
    const focused = setFocusGoal(data, goal.id); const switched = setFocusGoal(focused, data.goals[1].id);
    expect(switched.goals).toEqual(data.goals); expect(switched.completions).toEqual(data.completions);
    expect(setFocusGoal(switched).focusGoalId).toBeUndefined();
    const paused = pauseGoal(focused, goal.id); expect(paused.focusGoalId).toBeUndefined();
    expect(paused.goals[0]).toEqual({ ...goal, status: "paused" });
    const resumed = resumeGoal(paused, goal.id); expect(resumed.goals).toEqual(data.goals); expect(resumed.focusGoalId).toBeUndefined();
    expect(() => setFocusGoal(paused, goal.id)).toThrow();
    expect(() => setFocusGoal(resumed, uuid(999))).toThrow();
  });
  it("guards states, valid formal plans, cross-goal IDs, ownership and completed focus", () => {
    const draft = draftFixture(); expect(() => activateGoal(draft, draft.goals[0].id)).toThrow("计划需要"); expect(() => pauseGoal(draft, draft.goals[0].id)).toThrow(); expect(() => resumeGoal(draft, draft.goals[0].id)).toThrow(); expect(() => setFocusGoal(draft, draft.goals[0].id)).toThrow();
    const completed = completedFixture(); expect(() => resumeGoal(completed, completed.goals[0].id)).toThrow(); expect(() => activateGoal(completed, completed.goals[0].id)).toThrow(); expect(() => parseSnapshot({ ...completed, focusGoalId: completed.goals[0].id })).toThrow();
    const over = activeFixture(4); expect(() => parseSnapshot(over)).toThrow("active-limit");
    const bad = activeFixture(2); bad.goals[1].characterId = uuid(999); expect(() => parseSnapshot(bad)).toThrow();
    const duplicate = activeFixture(2); duplicate.goals[1].confirmedPlan!.content = structuredClone(duplicate.goals[0].confirmedPlan!.content); expect(() => parseSnapshot(duplicate)).toThrow();
    const drafts = draftFixture(); drafts.goals = [readyDraft(1), readyDraft(2)]; drafts.goals[1].draft!.content = structuredClone(drafts.goals[0].draft!.content); expect(() => parseSnapshot(drafts)).toThrow();
  });
  it("confirms legacy profession on the same character without touching avatar or history", () => {
    const old = completedFixture(); const next = confirmCharacterClass(old, "ranger");
    expect(next.character).toEqual({ ...old.character, classId: "pathfinder", appearanceId: "pathfinder-a-v1" });
    expect(next.goals).toEqual(old.goals); expect(next.completions).toEqual(old.completions);
    expect(visualAvatar(next.character!)).toBe("ranger"); expect(old.character?.classId).toBeUndefined();
    expect(() => confirmCharacterClass(next, "mage")).toThrow("已经确认");
    expect(() => parseSnapshot({ ...next, character: { ...next.character, appearanceId: "scholar-mage-a-v1" } })).toThrow();
  });
  it("derives one combined XP total from distinct completed adventures", () => {
    const data = completedFixture(); const other = structuredClone(data.goals[0]);
    other.id = uuid(200); const stage = other.confirmedPlan!.content.stages[0]; stage.id = uuid(201); stage.tasks[0].id = uuid(202);
    data.goals.push(other); data.completions.push({ ...data.completions[0], goalId: other.id, stageId: stage.id, taskId: stage.tasks[0].id });
    parseSnapshot(data); expect(characterGrowth(data.character!.id, data.completions)).toMatchObject({ totalXp: 80, abilities: { creativity: 80 } });
    const next = createGoal(data, { title: "新的旅程", baseline: "初学", successCriteria: "作品", weeklyHours: 3, direction: "knowledge" }, { id: () => uuid(203), now: () => stamp });
    expect(characterGrowth(next.character!.id, next.completions).totalXp).toBe(80);
  });
  it("accepts many independent drafts without an arbitrary product count cap", () => {
    const data = draftFixture(); const original = data.goals[0];
    data.goals = Array.from({ length: 1000 }, (_, n) => ({ ...structuredClone(original), id: uuid(n + 1000) }));
    expect(parseSnapshot(data).goals).toHaveLength(1000);
    data.goals[0].draft!.content.stages.push(readyDraft(1).draft!.content.stages[0]);
    expect(data.goals[1].draft!.content.stages).toEqual([]);
    expect(JSON.stringify(data).length).toBeLessThan(1_000_000);
  });
});
