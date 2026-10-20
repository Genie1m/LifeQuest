export const SCHEMA_VERSION = 1 as const;
export type Direction = "knowledge" | "vitality" | "creativity" | "action" | "social";
export type Difficulty = "light" | "standard" | "challenge";
export interface LocalProfile { id: string; createdAt: string }
export interface Character { id: string; profileId: string; name: string; avatarId: string; createdAt: string }
export interface Task {
  id: string; title: string; description: string; doneCriteria: string;
  estimatedMinutes: number; difficulty: Difficulty; status: "pending" | "completed"; completedAt?: string;
}
export interface Stage { id: string; title: string; milestone: string; tasks: Task[] }
export interface PlanContent { stages: Stage[] }
export interface ExecutionPlan { revision: number; content: PlanContent; confirmedAt: string }
export interface PlanDraft {
  baseRevision: number; content: PlanContent; source: "manual" | "mock";
  proposedWeeklyHours?: number; adjustmentFeedback?: string; updatedAt: string;
}
export interface Goal {
  id: string; characterId: string; title: string; successCriteria: string;
  direction: Direction; baseline: string; weeklyHours: number;
  status: "draft" | "active" | "completed"; createdAt: string; completedAt?: string;
  confirmedPlan?: ExecutionPlan; draft?: PlanDraft;
}
export interface CompletionEntry {
  taskId: string; goalId: string; stageId: string; characterId: string;
  direction: Direction; xp: number; difficulty: Difficulty;
  taskTitle: string; stageTitle: string; completedAt: string; note?: string;
}
export interface AppSnapshot {
  schemaVersion: typeof SCHEMA_VERSION; revision: number;
  profile?: LocalProfile; character?: Character; goals: Goal[]; completions: CompletionEntry[];
}
export function emptySnapshot(): AppSnapshot {
  return { schemaVersion: SCHEMA_VERSION, revision: 0, goals: [], completions: [] };
}
