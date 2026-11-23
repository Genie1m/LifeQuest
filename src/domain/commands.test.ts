import { describe, expect, it } from "vitest";
import { createCharacter, createGoal, validateCharacterInput, validateGoalInput } from "./commands";
import { emptySnapshot } from "./types";
import { completedFixture, draftFixture, ids, stamp } from "@/test/fixtures";
import { characterGrowth } from "./progression";

const input = { title: " 学会素描 ", successCriteria: "完成十张作品", baseline: "零基础", direction: "creativity", weeklyHours: 2.5 };
const env = { id: () => "66666666-6666-4666-8666-666666666666", now: () => stamp };
describe("creation transactions", () => {
  it("creates local identity and character together with no stored XP", () => {
    const queue = [ids.profile, ids.character];
    const result = createCharacter(emptySnapshot(), { name: " 星辰 ", avatarId: "mage" }, { ...env, id: () => queue.shift()! });
    expect(result.character?.name).toBe("星辰");
    expect(result.character?.profileId).toBe(result.profile?.id);
    expect(result.completions).toEqual([]);
    expect(result.character).not.toHaveProperty("xp");
    expect(characterGrowth(ids.character, [])).toMatchObject({ level: 1, totalXp: 0, abilities: { knowledge: 0, vitality: 0, creativity: 0, action: 0, social: 0 } });
    expect(() => createCharacter(result, { name: "另一个", avatarId: "mage" })).toThrow("已经有");
  });
  it.each(["", " ", "长".repeat(21)])("rejects invalid character name %s", name => {
    expect(() => validateCharacterInput({ name, avatarId: "mage" })).toThrow();
  });
  it("rejects unknown avatar", () => expect(() => validateCharacterInput({ name: "星", avatarId: "unknown" })).toThrow());
  it("requires a character and atomically creates only an empty manual draft", () => {
    expect(() => createGoal(emptySnapshot(), input)).toThrow("先创建");
    const data = draftFixture(); data.goals = [];
    const result = createGoal(data, input, env);
    expect(result.goals[0]).toMatchObject({ title: "学会素描", status: "draft", draft: { baseRevision: 0, source: "manual", content: { stages: [] } } });
    expect(result.goals[0].confirmedPlan).toBeUndefined();
    expect(result.completions).toEqual([]);
    expect(data.goals).toEqual([]);
  });
  it.each([0, 41, NaN, Infinity, -Infinity])("rejects invalid weekly hours %s", weeklyHours => expect(() => validateGoalInput({ ...input, weeklyHours })).toThrow());
  it.each(["title", "baseline", "successCriteria", "direction"])("requires %s", field => expect(() => validateGoalInput({ ...input, [field]: " " })).toThrow());
  it.each([["title", 81], ["baseline", 501], ["successCriteria", 501]] as const)("bounds %s", (field, count) => expect(() => validateGoalInput({ ...input, [field]: "字".repeat(count) })).toThrow());
  it("allows another independent draft alongside draft, active and completed goals", () => {
    expect(createGoal(draftFixture(), input, env).goals).toHaveLength(2);
    const active = completedFixture(); active.goals[0].status = "active"; delete active.goals[0].completedAt;
    active.completions = [];
    const task = active.goals[0].confirmedPlan!.content.stages[0].tasks[0]; task.status = "pending"; delete task.completedAt;
    expect(createGoal(active, input, env).goals).toHaveLength(2);
    const previous = completedFixture(); const result = createGoal(previous, input, env);
    expect(result.goals).toHaveLength(2);
    expect(result.completions).toEqual(previous.completions);
  });
});
