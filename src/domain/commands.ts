import { planIssues } from "./plan-readiness";
import { AVATARS, DIRECTIONS } from "./catalog";
import type { AppSnapshot, Direction, Goal, ClassId } from "./types";
import { parseSnapshot } from "./validation";

export type FieldErrors = Record<string, string>;
export class DomainError extends Error {
  constructor(
    public readonly code: "invalid-input" | "character-exists" | "character-required" | "invalid-transition" | "active-limit" | "goal-not-found" | "class-confirmed",
    message: string,
    public readonly fields: FieldErrors = {},
  ) { super(message); this.name = "DomainError"; }
}
export interface CommandEnvironment { id: () => string; now: () => string }
const environment: CommandEnvironment = { id: () => crypto.randomUUID(), now: () => new Date().toISOString() };
export interface CharacterInput { name: string; avatarId: string }
export interface GoalInput { title: string; successCriteria: string; baseline: string; direction: string; weeklyHours: number }

function requiredText(value: unknown, key: string, label: string, max: number, fields: FieldErrors) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) fields[key] = `请填写${label}`;
  else if (text.length > max) fields[key] = `${label}不能超过 ${max} 个字符`;
  return text;
}
function invalid(fields: FieldErrors) {
  if (Object.keys(fields).length) throw new DomainError("invalid-input", "请检查标记的字段，已填写内容会保留。", fields);
}
export function validateCharacterInput(input: CharacterInput): CharacterInput {
  const fields: FieldErrors = {};
  const name = requiredText(input.name, "name", "昵称", 20, fields);
  if (!AVATARS.some(avatar => avatar.id === input.avatarId)) fields.avatarId = "请选择一个冒险职业";
  invalid(fields);
  return { name, avatarId: input.avatarId };
}
export function validateGoalInput(input: GoalInput): GoalInput & { direction: Direction } {
  const fields: FieldErrors = {};
  const title = requiredText(input.title, "title", "目标名称", 80, fields);
  const successCriteria = requiredText(input.successCriteria, "successCriteria", "成功标准", 500, fields);
  const baseline = requiredText(input.baseline, "baseline", "当前基础", 500, fields);
  if (!DIRECTIONS.some(direction => direction.id === input.direction)) fields.direction = "请自主选择一个成长方向";
  if (!Number.isFinite(input.weeklyHours) || input.weeklyHours < 1 || input.weeklyHours > 40) fields.weeklyHours = "每周投入时间须为 1～40 小时";
  invalid(fields);
  return { title, successCriteria, baseline, direction: input.direction as Direction, weeklyHours: input.weeklyHours };
}

/** Pure transaction: local identity and character are created together, never persisted here. */
export function createCharacter(snapshot: AppSnapshot, input: CharacterInput, env = environment): AppSnapshot {
  parseSnapshot(snapshot);
  if (snapshot.profile || snapshot.character) throw new DomainError("character-exists", "这个浏览器已经有冒险角色，请返回冒险大厅。");
  const normalized = validateCharacterInput(input);
  const createdAt = env.now();
  const profile = { id: env.id(), createdAt };
  const character = { ...classFields(normalized.avatarId), id: env.id(), profileId: profile.id, ...normalized, createdAt };
  if (profile.id === character.id) throw new DomainError("invalid-input", "无法分配唯一角色标识，请重试。");
  return parseSnapshot({ ...snapshot, profile, character });
}

/** Pure transaction: a draft goal and empty plan are one state change; no planner or XP writes. */
export function createGoal(snapshot: AppSnapshot, input: GoalInput, env = environment): AppSnapshot {
  parseSnapshot(snapshot);
  if (!snapshot.character || !snapshot.profile) throw new DomainError("character-required", "请先创建你的冒险角色。");
  const normalized = validateGoalInput(input);
  const createdAt = env.now();
  const goal: Goal = {
    id: env.id(), characterId: snapshot.character.id, ...normalized, status: "draft", createdAt,
    draft: { baseRevision: 0, source: "manual", updatedAt: createdAt, content: { stages: [] } },
  };
  if (snapshot.goals.some(existing => existing.id === goal.id)) throw new DomainError("invalid-input", "无法分配唯一目标标识，请重试。");
  return parseSnapshot({ ...snapshot, goals: [...snapshot.goals, goal] });
}

export const CLASS_AVATARS: Record<ClassId, string> = { "scholar-mage": "mage", pathfinder: "ranger", artificer: "artisan" };
export function classFields(avatarId: string): { classId?: ClassId; appearanceId?: string } {
  const classId = (Object.keys(CLASS_AVATARS) as ClassId[]).find(id => CLASS_AVATARS[id] === avatarId);
  return classId ? { classId, appearanceId: `${classId}-a-v1` } : {};
}
export function visualAvatar(character: NonNullable<AppSnapshot["character"]>) {
  return character.classId ? CLASS_AVATARS[character.classId] : character.avatarId;
}
function findGoal(snapshot: AppSnapshot, id: string) {
  parseSnapshot(snapshot);
  const goal = snapshot.goals.find(g => g.id === id);
  if (!goal) throw new DomainError("goal-not-found", "未找到这条冒险，请重新读取。");
  return goal;
}
function availableSlot(snapshot: AppSnapshot) {
  if (snapshot.goals.filter(g => g.status === "active").length >= 3) throw new DomainError("active-limit", "已有 3 条活跃冒险，请先主动暂停一条，再激活或恢复其他冒险。");
}
function replaceGoal(snapshot: AppSnapshot, goal: Goal): AppSnapshot {
  return parseSnapshot({ ...snapshot, goals: snapshot.goals.map(g => g.id === goal.id ? goal : g) });
}
/** Reviewed first confirmation: one candidate snapshot, never a persistence side effect. */
export interface ActivationReview { revision: number; goal: string; focus: boolean }
export function activateGoal(snapshot: AppSnapshot, id: string, review: ActivationReview, env = environment): AppSnapshot {
  const goal = findGoal(snapshot, id);
  if (goal.status !== "draft" || !goal.draft) throw new DomainError("invalid-transition", "仅规划中的目标可以首次激活。");
  availableSlot(snapshot);
  if (!review || typeof review.focus !== "boolean" || snapshot.revision !== review.revision || JSON.stringify(goal) !== review.goal) throw new DomainError("invalid-input", "预览已过期，请重新打开最新预览。");
  const issues = planIssues(goal.draft.content, true);
  if (issues.length) throw new DomainError("invalid-input", issues.map(i => i.message).join("；"), Object.fromEntries(issues.map(i => [i.path, i.message])));
  const { draft, ...rest } = goal;
  const next: Goal = { ...rest, weeklyHours: draft.proposedWeeklyHours ?? goal.weeklyHours, status: "active", confirmedPlan: { revision: 1, content: structuredClone(draft.content), confirmedAt: env.now() } };
  try { return replaceGoal(review.focus ? { ...snapshot, focusGoalId: id } : snapshot, next); }
  catch { throw new DomainError("invalid-input", "正式计划尚不完整，请检查阶段和任务。"); }
}
export function pauseGoal(snapshot: AppSnapshot, id: string): AppSnapshot {
  const goal = findGoal(snapshot, id);
  if (goal.status !== "active") throw new DomainError("invalid-transition", "仅活跃冒险可以暂停。");
  const next = snapshot.focusGoalId === id ? clearFocus(snapshot) : snapshot;
  return replaceGoal(next, { ...goal, status: "paused" });
}
export function resumeGoal(snapshot: AppSnapshot, id: string): AppSnapshot {
  const goal = findGoal(snapshot, id);
  if (goal.status !== "paused") throw new DomainError("invalid-transition", "仅暂停的冒险可以恢复。");
  availableSlot(snapshot);
  return replaceGoal(snapshot, { ...goal, status: "active" });
}
/** Future task completion must clear focus in its same snapshot transaction before validation. */
export function clearFocus(snapshot: AppSnapshot): AppSnapshot {
  const next = { ...snapshot }; delete next.focusGoalId; return next;
}
export function setFocusGoal(snapshot: AppSnapshot, id?: string): AppSnapshot {
  parseSnapshot(snapshot);
  if (id === undefined) return parseSnapshot(clearFocus(snapshot));
  const goal = findGoal(snapshot, id);
  if (goal.status !== "active") throw new DomainError("invalid-transition", "只能将活跃冒险设为重点。");
  return parseSnapshot({ ...snapshot, focusGoalId: id });
}
export function confirmCharacterClass(snapshot: AppSnapshot, avatarId: string): AppSnapshot {
  parseSnapshot(snapshot);
  if (!snapshot.character) throw new DomainError("character-required", "请先创建角色。");
  if (snapshot.character.classId) throw new DomainError("class-confirmed", "职业已经确认，当前版本不提供转职。");
  if (!AVATARS.some(a => a.id === avatarId)) throw new DomainError("invalid-input", "请选择一个职业。");
  return parseSnapshot({ ...snapshot, character: { ...snapshot.character, ...classFields(avatarId) } });
}
