import {describe,it,expect} from 'vitest';
import {planningMode,outputInstructions,PLANNER_PROMPT_VERSION} from './instructions';
import {PROPOSAL_SCHEMA} from '@/domain/proposal';

describe('versioned planning scope and delivery contracts',()=>{
 it('treats initial draft summaries, including truncation, as initial planning',()=>{
  expect(planningMode()).toBe('initial');expect(planningMode({currentPlan:'{"mode":"initial","editableChapters":['})).toBe('initial');
  expect(planningMode({currentPlan:'{"mode":"replace-only-fully-pending-chapters"}'})).toBe('chapters');
 });
 it('keeps ID-scoped replanning separate from initial session splitting',()=>{
  const prompt=outputInstructions(PROPOSAL_SCHEMA,true,{replanContext:'{"tasks":[]}'});
  expect(planningMode({currentPlan:'{"mode":"initial"}',replanContext:'{}'})).toBe('tasks');
  expect(prompt).toContain('No additions, omissions, splitting IDs or merging tasks');expect(prompt).not.toContain('MODE: initial plan');
 });
 it('versions the experiment and keeps schema and connection tests independent',()=>{
  expect(PLANNER_PROMPT_VERSION).toBe('initial-v7-delivery-contracts');
  const prompt=outputInstructions(PROPOSAL_SCHEMA,true);expect(prompt).toContain('there is no preferred 6-12 task count');expect(prompt).toContain('Never require an error');expect(prompt).toContain('EACH gap');
  const test=outputInstructions({type:'object'},false);expect(test).toContain('{"ok":true}');expect(test).not.toContain('ACCEPTANCE CONTRACT');
 });
});
