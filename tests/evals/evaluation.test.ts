import {describe,it,expect} from 'vitest';
import {CASES} from './cases';
import {MockPlanner} from '../../src/services/planner/mock';
import {parsePlanningInput} from '../../src/services/planner/server';
import {contentPass,DIMENSIONS,RUBRIC_VERSION,structureCheck,summarize,type Review} from './evaluation';
import replan from './replan-5h-to-2h.json';
const review=(score=4):Review=>({kind:'human',reviewer:'test-only',rubricVersion:RUBRIC_VERSION,scores:Object.fromEntries(DIMENSIONS.map(k=>[k,{score,evidence:'Test assertion, not actual human scoring'}])) as Review['scores']});
describe('versioned evaluation contract',()=>{
 it('keeps transport failures in request denominator without inventing a structural observation',()=>{const r=summarize([{source:'real',attemptKind:'first',structure:null,review:null,firstGenerationSucceeded:false}]);expect(r.structureRate).toBeNull();expect(r.requestStructureRate).toBe(0);expect(r.structureUnobserved).toBe(1);expect(r.qualificationRate).toBe(0);});
 it('makes the 5h to 2h tradeoff explicit without editing a plan',()=>{const required=replan.remaining.filter(t=>t.required).reduce((n,t)=>n+t.minutes,0);expect(required).toBe(replan.expected.remainingRequiredMinutes);const capacity=replan.remainingWeeks*replan.requestedWeeklyHours*60;expect(capacity).toBe(replan.expected.newCapacityMinutes);expect(required).toBeGreaterThan(capacity);expect(Math.ceil(required/(replan.requestedWeeklyHours*60))).toBe(replan.expected.minimumRequiredWeeks);});
 it.each(CASES)('$id has valid fixed input and Mock structure',async c=>{expect(parsePlanningInput(c.input)).toEqual(c.input);expect(structureCheck(c,(await new MockPlanner().generate(c.input)).proposal)).toBe(true);});
 it('uses unique cases, fixed budgets and paired cross-class inputs',()=>{expect(new Set(CASES.map(c=>c.id)).size).toBe(CASES.length);expect(CASES.slice(0,5).map(c=>c.input.weeklyHours)).toEqual([5,8,5,3,6]);expect(CASES.find(c=>c.id==='A-ranger')!.input).toEqual(CASES[0].input);});
 it('rejects unauthorized fields even in an otherwise valid Mock',async()=>{const p=(await new MockPlanner().generate(CASES[0].input)).proposal;expect(structureCheck(CASES[0],{...p,xp:100})).toBe(false);});
 it('never treats unscored or AI-only reviews as human success',()=>{expect(contentPass(null)).toBeNull();expect(contentPass({...review(),kind:'ai-assisted'})).toBeNull();expect(summarize([{source:'mock',attemptKind:'first',structure:true,review:null}]).qualificationRate).toBeNull();});
 it('enforces anchors, evidence and important dimensions',()=>{expect(contentPass(review())).toBe(true);expect(contentPass(review(3))).toBe(false);const r=review();r.scores.time={score:3,evidence:'Limited but feasible'};expect(contentPass(r)).toBe(true);r.scores.time.evidence='';expect(()=>contentPass(r)).toThrow();r.scores.time={score:6,evidence:'bad'};expect(()=>contentPass(r)).toThrow();});
 it('keeps retry and edited results out of the first-attempt numerator',()=>{const s=summarize([{source:'real',attemptKind:'first',structure:false,review:null},{source:'real',attemptKind:'retry',structure:true,review:review()},{source:'real',attemptKind:'edited',structure:true,review:review()}]);expect(s.qualificationRate).toBe(0);expect(s.firstAttempts).toBe(1);expect(summarize([]).qualificationRate).toBeNull();});
 it('does not pool Mock with real',()=>{expect(()=>summarize([{source:'mock',attemptKind:'first',structure:true,review:null},{source:'real',attemptKind:'first',structure:true,review:null}])).toThrow();});
});
