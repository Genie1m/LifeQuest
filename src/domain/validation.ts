import { SCHEMA_VERSION, TASK_PROGRESS_LABELS, type AppSnapshot, type PlanContent, type Goal, type Character } from "./types";

export class SnapshotValidationError extends Error {
  constructor(public readonly code: "invalid-data" | "unsupported-version", message: string) {
    super(message); this.name = "SnapshotValidationError";
  }
}
function requireValue(condition: unknown, path: string): asserts condition {
  if (!condition) throw new SnapshotValidationError("invalid-data", `快照字段无效：${path}`);
}
function object(value: unknown, path: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), path);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, max: number, required = true) {
  requireValue(typeof value === "string" && value.length <= max && (!required || value.trim().length > 0), path);
}
function integer(value: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max, path);
}
function uuid(value: unknown, path: string) {
  requireValue(typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), path);
}
function date(value: unknown, path: string) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), path);
}
function enumeration(value: unknown, allowed: readonly string[], path: string) {
  requireValue(typeof value === "string" && allowed.includes(value), path);
}
const directions = ["knowledge", "vitality", "creativity", "action", "social"];
const difficulties = ["light", "standard", "challenge"];
function replanSettings(raw:unknown,goal:Goal,draft:boolean){
 const r=object(raw,'replan');requireValue(typeof r.weeklyHours==='number'&&Number.isFinite(r.weeklyHours)&&r.weeklyHours>=1&&r.weeklyHours<=40,'replan.weeklyHours');integer(r.windowWeeks,'replan.windowWeeks',1,520);text(r.feedback,'replan.feedback',1000);enumeration(r.strategy,['extend','defer'],'replan.strategy');
 const tasks=goal.confirmedPlan!.content.stages.flatMap(s=>s.tasks);
 if(r.requestedWeeks!==undefined)integer(r.requestedWeeks,'replan.requestedWeeks',1,520);
 for(const key of ['selectedTaskIds','deferredTaskIds']){const list=r[key];requireValue(Array.isArray(list)&&list.length<=50&&new Set(list).size===list.length,'replan.ids');for(const id of list){uuid(id,'replan.taskId');requireValue(tasks.some(t=>t.id===id&&(!draft||t.status==='pending')),'replan.owner');}}
 requireValue((r.selectedTaskIds as string[]).length>0&&(r.deferredTaskIds as string[]).every(id=>(r.selectedTaskIds as string[]).includes(id))&&(r.strategy!=='extend'||(r.deferredTaskIds as string[]).length===0),'replan.scope');
}

// Drafts intentionally permit unfinished text/empty stages; activation validation is stricter.
function plan(value: unknown, path: string, confirmed: boolean, replan = false) {
  const content = object(value, path);
  requireValue(Array.isArray(content.stages) && content.stages.length <= 10 && (!confirmed || content.stages.length > 0), `${path}.stages`);
  const ids = new Set<string>();
  let count = 0;
  function unique(id: unknown) {
    uuid(id, `${path}.id`);
    requireValue(!ids.has(id as string), `${path}.duplicateId`); ids.add(id as string);
  }
  content.stages.forEach((raw, index) => {
    const p = `${path}.stages[${index}]`; const stage = object(raw, p); unique(stage.id);
    text(stage.title, `${p}.title`, 80, confirmed); text(stage.milestone, `${p}.milestone`, 500, false);
    requireValue(Array.isArray(stage.tasks) && (!confirmed || stage.tasks.length > 0), `${p}.tasks`);
    if (stage.checkpointTaskId !== undefined) {
      uuid(stage.checkpointTaskId, `${p}.checkpointTaskId`);
      requireValue(stage.tasks.some(raw => object(raw, p).id === stage.checkpointTaskId), `${p}.checkpointTaskId.owner`);
    }
    count += stage.tasks.length;
    stage.tasks.forEach((rawTask, taskIndex) => {
      const t = `${p}.tasks[${taskIndex}]`; const task = object(rawTask, t); unique(task.id);
      text(task.title, `${t}.title`, 80, confirmed); text(task.description, `${t}.description`, 500, false);
      text(task.doneCriteria, `${t}.doneCriteria`, 500, confirmed);
      integer(task.estimatedMinutes, `${t}.estimatedMinutes`, confirmed ? 5 : 0, confirmed ? 600 : 100000);
      enumeration(task.difficulty, difficulties, `${t}.difficulty`);
      enumeration(task.status, ["pending", "completed"], `${t}.status`);
      if (task.status === "completed") date(task.completedAt, `${t}.completedAt`);
      else requireValue(task.completedAt === undefined, `${t}.completedAt`);
      if (task.progress !== undefined) {
        requireValue((confirmed || replan) && task.status === 'pending', `${t}.progress.owner`);
        const progress = object(task.progress, `${t}.progress`);
        enumeration(progress.status, Object.keys(TASK_PROGRESS_LABELS), `${t}.progress.status`);
        text(progress.note, `${t}.progress.note`, 1000, progress.status === 'blocked');
      }
    });
  });
  requireValue(count <= 50, `${path}.taskCount`);
}

/** Decode only validated v2 data. Never repairs or removes the original storage value. */
export function parseSnapshot(value: unknown): AppSnapshot {
  const snapshot = object(value, "snapshot");
  if (snapshot.schemaVersion !== SCHEMA_VERSION) {
    throw new SnapshotValidationError("unsupported-version", "不支持此数据版本；原始数据已保留。");
  }
  integer(snapshot.revision, "revision", 0);
  requireValue(Array.isArray(snapshot.goals), "goals");
  requireValue(Array.isArray(snapshot.completions), "completions");
  requireValue((snapshot.profile === undefined) === (snapshot.character === undefined), "profile/character");
  if (snapshot.profile !== undefined) {
    const profile = object(snapshot.profile, "profile"); uuid(profile.id, "profile.id"); date(profile.createdAt, "profile.createdAt");
    const character = object(snapshot.character, "character"); uuid(character.id, "character.id");
    requireValue(character.profileId === profile.id, "character.profileId");
    text(character.name, "character.name", 20); text(character.avatarId, "character.avatarId", 80); date(character.createdAt, "character.createdAt");
    requireValue((character.classId === undefined) === (character.appearanceId === undefined), "character.class/appearance");
    if (character.classId !== undefined) {
      enumeration(character.classId, ["scholar-mage", "pathfinder", "artificer"], "character.classId");
      requireValue(character.appearanceId === `${character.classId}-a-v1`, "character.appearanceId");
    }
  } else requireValue(snapshot.goals.length === 0 && snapshot.completions.length === 0, "orphaned-data");

  const goalIds = new Set<string>(); const formalIds = new Set<string>(); let active = 0;
  snapshot.goals.forEach((raw, index) => {
    const p = `goals[${index}]`; const goal = object(raw, p); uuid(goal.id, `${p}.id`);
    requireValue(!goalIds.has(goal.id as string), `${p}.duplicateId`); goalIds.add(goal.id as string);
    requireValue(goal.characterId === object(snapshot.character, "character").id, `${p}.characterId`);
    text(goal.title, `${p}.title`, 80); text(goal.successCriteria, `${p}.successCriteria`, 500);
    text(goal.baseline, `${p}.baseline`, 500); enumeration(goal.direction, directions, `${p}.direction`);
    requireValue(typeof goal.weeklyHours === "number" && Number.isFinite(goal.weeklyHours) && goal.weeklyHours >= 1 && goal.weeklyHours <= 40, `${p}.weeklyHours`);
    enumeration(goal.status, ["draft", "active", "paused", "completed"], `${p}.status`); date(goal.createdAt, `${p}.createdAt`);
    if (goal.status === "active") active++;
    if (goal.status === "completed") date(goal.completedAt, `${p}.completedAt`);
    else requireValue(goal.completedAt === undefined, `${p}.completedAt`);
    if (goal.confirmedPlan !== undefined) {
      const execution = object(goal.confirmedPlan, `${p}.confirmedPlan`);
      integer(execution.revision, `${p}.confirmedPlan.revision`, 1); date(execution.confirmedAt, `${p}.confirmedAt`);
      plan(execution.content, `${p}.confirmedPlan.content`, true);
      requireValue(goal.status !== "draft", `${p}.draft-with-confirmed-plan`);
      const content = execution.content as PlanContent;
      if(execution.adjustment!==undefined)replanSettings(execution.adjustment,goal as unknown as Goal,false);
      if(execution.adjustmentReview!==undefined){requireValue(execution.adjustment!==undefined,'adjustmentReview.owner');text(execution.adjustmentReview,'adjustmentReview',1000);}
      for (const stage of content.stages) for (const id of [stage.id, ...stage.tasks.map(t => t.id)]) {
        requireValue(!formalIds.has(id), `${p}.duplicateFormalId`); formalIds.add(id);
      }
      const allComplete = content.stages.every(s => s.tasks.every(t => t.status === "completed"));
      requireValue((goal.status === "completed") === allComplete, `${p}.completionState`);
    } else requireValue(goal.status === "draft", `${p}.missing-confirmed-plan`);
    if (goal.draft !== undefined) {
      const draft = object(goal.draft, `${p}.draft`);
      integer(draft.baseRevision, `${p}.draft.baseRevision`, 0);
      requireValue(draft.baseRevision === (goal.confirmedPlan ? object(goal.confirmedPlan, p).revision : 0), `${p}.draft.staleRevision`);
      enumeration(draft.source, ["manual", "mock"], `${p}.draft.source`); date(draft.updatedAt, `${p}.draft.updatedAt`);
      if (draft.proposedWeeklyHours !== undefined) requireValue(typeof draft.proposedWeeklyHours === "number" && Number.isFinite(draft.proposedWeeklyHours) && draft.proposedWeeklyHours >= 1 && draft.proposedWeeklyHours <= 40, `${p}.draft.proposedWeeklyHours`);
      if (draft.adjustmentFeedback !== undefined) text(draft.adjustmentFeedback, `${p}.draft.adjustmentFeedback`, Number.MAX_SAFE_INTEGER, false);
      plan(draft.content, `${p}.draft.content`, false, draft.replan !== undefined);
      if(draft.replan!==undefined){requireValue(goal.confirmedPlan!==undefined,'replan.formal');replanSettings(draft.replan,goal as unknown as Goal,true);requireValue(draft.proposedWeeklyHours===object(draft.replan,'replan').weeklyHours,'replan.budget');}
      requireValue(goal.status !== "completed", `${p}.completed-with-draft`);
    } else requireValue(goal.status !== "draft", `${p}.missing-draft`);
  });
  requireValue(active <= 3, "active-limit");
  if (snapshot.focusGoalId !== undefined) {
    uuid(snapshot.focusGoalId, "focusGoalId");
    requireValue((snapshot.goals as Goal[]).some(g => g.id === snapshot.focusGoalId && g.status === "active" && g.characterId === (snapshot.character as Character | undefined)?.id), "focusGoalId.active-owner");
  }

  const owners = new Map<string, string>();
  for (const raw of snapshot.goals) {
    const goal = raw as Goal;
    for (const content of [goal.confirmedPlan?.content, goal.draft?.content]) for (const stage of content?.stages ?? []) for (const id of [stage.id, ...stage.tasks.map(t => t.id)]) {
      requireValue(!goalIds.has(id) && (!owners.has(id) || owners.get(id) === goal.id), "cross-goal-plan-id");
      owners.set(id, goal.id);
    }
  }
  const data = value as AppSnapshot; const settled = new Set<string>();
  data.completions.forEach((entry, index) => {
    const p = `completions[${index}]`; object(entry, p);
    for (const key of ["taskId", "goalId", "stageId", "characterId"] as const) uuid(entry[key], `${p}.${key}`);
    requireValue(!settled.has(entry.taskId), `${p}.duplicateTask`); settled.add(entry.taskId);
    enumeration(entry.direction, directions, `${p}.direction`); enumeration(entry.difficulty, difficulties, `${p}.difficulty`);
    requireValue(entry.xp === ({ light: 20, standard: 40, challenge: 60 } as const)[entry.difficulty], `${p}.xp`);
    text(entry.taskTitle, `${p}.taskTitle`, 80); text(entry.stageTitle, `${p}.stageTitle`, 80); date(entry.completedAt, `${p}.completedAt`);
    if (entry.note !== undefined) text(entry.note, `${p}.note`, Number.MAX_SAFE_INTEGER, false);
    const goal = data.goals.find(g => g.id === entry.goalId);
    const stage = goal?.confirmedPlan?.content.stages.find(s => s.id === entry.stageId);
    const task = stage?.tasks.find(t => t.id === entry.taskId);
    requireValue(task?.status === "completed" && task.completedAt === entry.completedAt && goal?.characterId === entry.characterId && goal.direction === entry.direction && task.difficulty === entry.difficulty && task.title === entry.taskTitle && stage?.title === entry.stageTitle, `${p}.source`);
  });
  for (const goal of data.goals) for (const stage of goal.confirmedPlan?.content.stages ?? []) for (const task of stage.tasks) {
    requireValue((task.status === "completed") === settled.has(task.id), "task/ledger-mismatch");
  }
  return data;
}
