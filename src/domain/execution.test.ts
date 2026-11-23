import {describe,it,expect} from 'vitest';
import {completeTask,achievements,goalProgress,recordTaskProgress,stageProgress} from './execution';
import {startRevision} from './revision';
import {characterGrowth} from './progression';
import {parseSnapshot} from './validation';
import {executionFixture} from '@/test/execution-fixtures';
import {completedFixture} from '@/test/fixtures';
import type {AppSnapshot} from './types';
const finish=(s:AppSnapshot,stage=0,task=0,note='')=>completeTask(s,s.goals[0].id,s.goals[0].confirmedPlan!.content.stages[stage].tasks[task].id,{goal:JSON.stringify(s.goals[0]),confirmed:true},note,()=> '2026-11-20T10:00:00.000Z');

describe('real task completion transaction',()=>{
 it('records blockers and postponement without progress credit, and resumes with the same task ID',()=>{
  const original=executionFixture();
  const goal=original.goals[0];
  const stage=goal.confirmedPlan!.content.stages[0];
  const taskId=stage.tasks[0].id;
  expect(()=>recordTaskProgress(original,goal.id,taskId,JSON.stringify(goal),'blocked',' ')).toThrow('受阻原因');
  const blocked=recordTaskProgress(original,goal.id,taskId,JSON.stringify(goal),'blocked','缺少样例');
  const blockedGoal=blocked.goals[0];
  expect(blockedGoal.confirmedPlan!.content.stages[0].tasks[0]).toMatchObject({id:taskId,status:'pending',progress:{status:'blocked',note:'缺少样例'}});
  expect(goalProgress(blockedGoal)).toMatchObject({done:0,completedStages:0,nextTask:{id:stage.tasks[1].id}});
  expect(blocked.completions).toEqual([]);
  expect(()=>recordTaskProgress(blocked,goal.id,taskId,JSON.stringify(goal),'in-progress','')).toThrow(/已变化/);
  const revision=startRevision(blocked,goal.id,JSON.stringify(blockedGoal));
  expect(revision.goals[0].draft!.content.stages.map(item=>item.id)).not.toContain(stage.id);
  const postponed=recordTaskProgress(blocked,goal.id,taskId,JSON.stringify(blockedGoal),'postponed','稍后处理');
  const resumed=recordTaskProgress(postponed,goal.id,taskId,JSON.stringify(postponed.goals[0]),'in-progress','已找到样例');
  expect(goalProgress(resumed.goals[0]).nextTask?.id).toBe(taskId);
  const completed=finish(resumed);
  expect(completed.snapshot.completions).toHaveLength(1);
  expect(completed.snapshot.goals[0].confirmedPlan!.content.stages[0].tasks[0].progress).toBeUndefined();
  expect(finish(completed.snapshot).receipt).toBeNull();
 });
 it('shows a reached checkpoint without completing its chapter or awarding the chapter badge',()=>{
  const first=finish(executionFixture());
  const stage=first.snapshot.goals[0].confirmedPlan!.content.stages[0];
  expect(stageProgress(stage)).toEqual({done:1,total:2,checkpointReached:true,complete:false});
  expect(first.receipt).toMatchObject({stageCompleted:false,goalCompleted:false,xp:20});
  expect(achievements(first.snapshot).find(badge=>badge.id==='first-stage')?.unlocked).toBe(false);
  expect(finish(first.snapshot,0,1).receipt).toMatchObject({stageCompleted:true,xp:40});
 });
 it('atomically creates one difficulty-based ledger entry and changes only its task',()=>{
  const s=executionFixture(),before=structuredClone(s);const r=finish(s,0,0,' 一段录音已保存 ');
  expect(s).toEqual(before);expect(r.snapshot.completions).toHaveLength(1);expect(r.snapshot.completions[0]).toMatchObject({xp:20,note:'一段录音已保存',direction:'creativity',taskTitle:'录制一次问答练习'});expect(r.snapshot.goals[0].confirmedPlan!.content.stages[0].tasks[0].status).toBe('completed');expect(r.snapshot.goals[0].confirmedPlan!.content.stages[0].tasks[1]).toEqual(s.goals[0].confirmedPlan!.content.stages[0].tasks[1]);expect(r.receipt).toMatchObject({xp:20,stageCompleted:false,goalCompleted:false,newAchievements:['踏出第一步']});expect(parseSnapshot(r.snapshot)).toBe(r.snapshot);
 });
 it('uses 20/40/60 XP exactly once, awards no stage bonus and completes/frees focus atomically',()=>{
  let s=executionFixture();s=finish(s).snapshot;const second=finish(s,0,1);expect(second.receipt).toMatchObject({xp:40,stageCompleted:true,nextStageTitle:'模拟交付',newAchievements:['章节开拓者']});s=second.snapshot;const last=finish(s,1);expect(last.receipt).toMatchObject({xp:60,levelBefore:1,levelAfter:2,goalCompleted:true,newAchievements:['抵达终点']});expect(last.snapshot.goals[0].status).toBe('completed');expect(last.snapshot.focusGoalId).toBeUndefined();expect(last.snapshot.goals[0].completedAt).toBe(last.snapshot.completions[2].completedAt);const growth=characterGrowth(s.character!.id,last.snapshot.completions);expect(growth.totalXp).toBe(120);expect(growth.abilities.creativity).toBe(120);expect(Object.values(growth.abilities).reduce((n,x)=>n+x,0)).toBe(growth.totalXp);expect(goalProgress(last.snapshot.goals[0])).toMatchObject({done:3,total:3,percent:100,completedStages:2});
 });
 it('returns no receipt or extra XP for duplicate and final-task replay',()=>{
  let s=finish(executionFixture()).snapshot;const duplicate=finish(s);expect(duplicate.snapshot).toBe(s);expect(duplicate.receipt).toBeNull();s=finish(s,0,1).snapshot;s=finish(s,1).snapshot;expect(finish(s,1).receipt).toBeNull();expect(s.completions).toHaveLength(3);
 });
 it.each(['paused','draft'] as const)('rejects %s and retains the original snapshot',status=>{
  const s=executionFixture();if(status==='paused'){s.goals[0].status='paused';delete s.focusGoalId;}else{s.goals[0].draft={source:'manual',baseRevision:1,updatedAt:'2026-11-20T10:00:00.000Z',content:{stages:[]}};}
  const before=structuredClone(s);expect(()=>finish(s)).toThrow(/仅活跃/);expect(s).toEqual(before);
 });
 it('rejects a missing/foreign task, declined review, stale goal, oversized note and invalid clock',()=>{
  const s=executionFixture(),g=s.goals[0],t=g.confirmedPlan!.content.stages[0].tasks[0];
  expect(()=>completeTask(s,g.id,crypto.randomUUID(),{goal:JSON.stringify(g),confirmed:true})).toThrow('未找到');
  for(const review of [{goal:JSON.stringify(g),confirmed:false},{goal:'old goal',confirmed:true}])expect(()=>completeTask(s,g.id,t.id,review)).toThrow('确认');
  expect(()=>finish(s,0,0,'x'.repeat(1001))).toThrow('1000');expect(()=>completeTask(s,g.id,t.id,{goal:JSON.stringify(g),confirmed:true},'',()=> 'invalid-date')).toThrow();expect(s.completions).toEqual([]);
 });
 it('allows later-chapter real work without locking progression or falsely completing earlier stages',()=>{
  const r=finish(executionFixture(),1);expect(r.receipt).toMatchObject({stageCompleted:true,goalCompleted:false,nextStageTitle:'收集与演练'});expect(goalProgress(r.snapshot.goals[0])).toMatchObject({done:1,completedStages:1});expect(r.snapshot.goals[0].status).toBe('active');
 });
 it('derives historical badges without inserting rewards or rewriting old records',()=>{
  const s=completedFixture(),before=JSON.stringify(s);expect(achievements(s).every(a=>a.unlocked)).toBe(true);expect(JSON.stringify(s)).toBe(before);expect(characterGrowth(s.character!.id,s.completions).totalXp).toBe(40);
 });
 it('keeps another goal/history and its direction XP intact',()=>{
  const s=executionFixture();const other=completedFixture().goals[0];other.id=crypto.randomUUID();other.direction='knowledge';other.confirmedPlan!.content.stages[0].id=crypto.randomUUID();other.confirmedPlan!.content.stages[0].tasks[0].id=crypto.randomUUID();s.goals.push(other);const t=other.confirmedPlan!.content.stages[0].tasks[0];s.completions=[{taskId:t.id,goalId:other.id,stageId:other.confirmedPlan!.content.stages[0].id,characterId:other.characterId,direction:other.direction,xp:40,difficulty:t.difficulty,taskTitle:t.title,stageTitle:other.confirmedPlan!.content.stages[0].title,completedAt:t.completedAt!}];
  const r=finish(s);expect(r.snapshot.goals[1]).toEqual(other);expect(r.snapshot.completions[0]).toEqual(s.completions[0]);expect(r.snapshot.completions).toHaveLength(2);expect(characterGrowth(s.character!.id,r.snapshot.completions).abilities).toMatchObject({creativity:20,knowledge:40});expect(()=>completeTask(s,s.goals[0].id,t.id,{goal:JSON.stringify(s.goals[0]),confirmed:true})).toThrow('未找到');
 });
});
