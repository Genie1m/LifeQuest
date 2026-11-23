import { describe, it, expect } from "vitest";
import { editGoal, savePlan, planIssues } from "./editor";
import { draftFixture, completedFixture, stamp } from "@/test/fixtures";
import { readyDraft, activeFixture } from "@/test/multi-fixtures";
import { LocalStorageRepository, STORAGE_KEY } from "@/services/repository";
import { parseSnapshot } from "./validation";
const input = { title: "摄影作品集", successCriteria: "交付十二张作品", baseline: "初学", direction: "action", weeklyHours: 3.5 };
describe("draft editing boundaries", () => {
  it("edits all metadata without replacing the goal or losing its plan", async () => {
    const s = draftFixture(); s.goals = [readyDraft(1),readyDraft(2)]; const old = structuredClone(s);
    const next = editGoal(s,s.goals[0].id,input);
    expect(next.goals[0]).toEqual({ ...old.goals[0],...input }); expect(next.goals[1]).toEqual(old.goals[1]); expect(s).toEqual(old); expect(next.completions).toEqual(old.completions);
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(s));const repo=new LocalStorageRepository();await repo.save({...next,revision:s.revision+1},s.revision);expect((await repo.load())?.goals).toEqual(next.goals);
  });
  it.each([{...input,title:" "},{...input,weeklyHours:0},{...input,direction:"bad"},{...input,successCriteria:""}])("rejects illegal metadata", bad => expect(()=>editGoal(draftFixture(),draftFixture().goals[0].id,bad)).toThrow());
  it.each([activeFixture(1),completedFixture()])("never edits formal history", s => {
    expect(()=>editGoal(s,s.goals[0].id,input)).toThrow();expect(()=>savePlan(s,s.goals[0].id,{stages:[]})).toThrow();
    const paused=activeFixture(1);paused.goals[0].status="paused";expect(()=>savePlan(paused,paused.goals[0].id,{stages:[]})).toThrow();
  });
  it("saves ordered chapters/tasks and checkpoints with stable IDs and refresh", async () => {
    const s=draftFixture();s.goals=[readyDraft(1),readyDraft(2)];const content=structuredClone(s.goals[0].draft!.content);content.stages.push(readyDraft(3).draft!.content.stages[0]);content.stages.reverse();content.stages[0].tasks.push(readyDraft(4).draft!.content.stages[0].tasks[0]);content.stages[0].tasks.reverse();content.stages[0].checkpointTaskId=content.stages[0].tasks[0].id;
    const next=savePlan(s,s.goals[0].id,content,stamp);expect(next.goals[0].draft!.content).toEqual(content);expect(next.goals[1]).toEqual(s.goals[1]);expect(next.goals[0].status).toBe('draft');expect(next.goals[0].confirmedPlan).toBeUndefined();expect(next.completions).toEqual(s.completions);
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(s));const repo=new LocalStorageRepository();await repo.save({...next,revision:s.revision+1},s.revision);expect((await repo.load())?.goals).toEqual(next.goals);
  });
  it("allows an empty saved draft but reports missing readiness",()=>{const s=draftFixture();expect(savePlan(s,s.goals[0].id,{stages:[]}).goals[0].draft!.content.stages).toEqual([]);expect(planIssues({stages:[]})).toHaveLength(1);});
  it("rejects foreign checkpoints, duplicate and cross-goal identifiers",()=>{const s=draftFixture();s.goals=[readyDraft(1),readyDraft(2)];const c=structuredClone(s.goals[0].draft!.content);c.stages[0].checkpointTaskId=s.goals[1].draft!.content.stages[0].tasks[0].id;expect(()=>savePlan(s,s.goals[0].id,c)).toThrow();expect(()=>parseSnapshot({...s,goals:[{...s.goals[0],draft:{...s.goals[0].draft!,content:c}},s.goals[1]]})).toThrow();expect(()=>savePlan(s,s.goals[0].id,s.goals[1].draft!.content)).toThrow();});
  it("checks final readiness without requiring checkpoints in legacy snapshots",()=>{const s=draftFixture();const c=readyDraft(1).draft!.content;expect(planIssues(c).some(i=>i.message.includes('检查点'))).toBe(true);c.stages[0].checkpointTaskId=c.stages[0].tasks[0].id;expect(planIssues(c)).toEqual([]);c.stages[0].tasks[0].doneCriteria=' ';expect(()=>savePlan(s,s.goals[0].id,c)).toThrow();c.stages[0].tasks[0].doneCriteria='作品';c.stages[0].tasks[0].estimatedMinutes=-1;expect(()=>savePlan(s,s.goals[0].id,c)).toThrow();});
});
