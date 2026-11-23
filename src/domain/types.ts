export const SCHEMA_VERSION = 2 as const;
export type Direction = "knowledge" | "vitality" | "creativity" | "action" | "social";
export type Difficulty = "light" | "standard" | "challenge";
export interface LocalProfile { id: string; createdAt: string }
export type ClassId = "scholar-mage" | "pathfinder" | "artificer";
export interface Character { classId?: ClassId; appearanceId?: string; id: string; profileId: string; name: string; avatarId: string; createdAt: string }
export const TASK_PROGRESS_LABELS = { 'in-progress': '进行中', blocked: '受阻', postponed: '已推迟' } as const;
export type TaskProgressStatus = keyof typeof TASK_PROGRESS_LABELS;
export interface Task {
  id: string; title: string; description: string; doneCriteria: string;
  estimatedMinutes: number; difficulty: Difficulty; status: "pending" | "completed"; completedAt?: string;
  progress?: { status: TaskProgressStatus; note: string };
}
export interface Stage { checkpointTaskId?: string; id: string; title: string; milestone: string; tasks: Task[] }
export interface PlanContent { stages: Stage[] }
export interface ReplanSettings { weeklyHours:number; windowWeeks:number; requestedWeeks?:number; feedback:string; selectedTaskIds:string[]; deferredTaskIds:string[]; strategy:'extend'|'defer' }
export interface ExecutionPlan { revision: number; content: PlanContent; confirmedAt: string; adjustment?:ReplanSettings; adjustmentReview?:string }
export interface PlanDraft {
  replan?:ReplanSettings;
  baseRevision: number; content: PlanContent; source: "manual" | "mock";
  proposedWeeklyHours?: number; adjustmentFeedback?: string; updatedAt: string;
}
export interface Goal {
  id: string; characterId: string; title: string; successCriteria: string;
  direction: Direction; baseline: string; weeklyHours: number;
  status: "draft" | "active" | "paused" | "completed"; createdAt: string; completedAt?: string;
  confirmedPlan?: ExecutionPlan; draft?: PlanDraft;
}
export interface CompletionEntry {
  taskId: string; goalId: string; stageId: string; characterId: string;
  direction: Direction; xp: number; difficulty: Difficulty;
  taskTitle: string; stageTitle: string; completedAt: string; note?: string;
}
export interface AppSnapshot {
  schemaVersion: typeof SCHEMA_VERSION; revision: number; focusGoalId?: string;
  profile?: LocalProfile; character?: Character; goals: Goal[]; completions: CompletionEntry[];
}
export function emptySnapshot(): AppSnapshot {
  return { schemaVersion: SCHEMA_VERSION, revision: 0, goals: [], completions: [] };
}
