import {createCharacter,createGoal} from '../../src/domain/commands';
import {emptySnapshot} from '../../src/domain/types';
import {importProposal} from '../../src/domain/proposal';
import type {EvalCase} from './cases';
export const RUBRIC_VERSION='quality-1.0.0';
export const DIMENSIONS=['alignment','baseline','time','actionability','verification','sequence','reliability'] as const;
export type Dimension=typeof DIMENSIONS[number];
export interface Review {kind:'human'|'ai-assisted';reviewer:string;rubricVersion:string;scores:Record<Dimension,{score:number;evidence:string}>}
export function contentPass(review:Review|null):boolean|null {
 if(!review||review.kind!=='human')return null;
 if(review.rubricVersion!==RUBRIC_VERSION||!review.reviewer.trim())throw new Error('Invalid review metadata');
 for(const k of DIMENSIONS){const s=review.scores[k];if(!s||!Number.isInteger(s.score)||s.score<1||s.score>5||!s.evidence.trim())throw new Error('Missing score or evidence');}
 return DIMENSIONS.every(k=>review.scores[k].score>=3)&&(['alignment','actionability','verification'] as const).every(k=>review.scores[k].score>=4);
}
export function structureCheck(c:EvalCase,raw:unknown):boolean {
 try{const snapshot=createGoal(createCharacter(emptySnapshot(),{name:'独立评测角色',avatarId:c.avatarId}),c.input);const goal=snapshot.goals[0];importProposal(snapshot,{goalId:goal.id,revision:snapshot.revision,goal:JSON.stringify(goal)},raw);return true;}catch{return false;}
}
export interface Outcome {source:'mock'|'real';attemptKind:'first'|'retry'|'repair'|'edited';structure:boolean|null;review:Review|null;firstGenerationSucceeded?:boolean}
export function summarize(rows:Outcome[]){
 const groups=rows.filter(r=>r.attemptKind==='first');
 if(new Set(groups.map(r=>r.source)).size>1)throw new Error('Do not mix Mock and real');
 const scored=groups.filter(r=>r.structure===false||r.firstGenerationSucceeded===false||r.review?.kind==='human');
 const qualified=groups.filter(r=>r.structure===true&&contentPass(r.review)===true).length;
 const observed=groups.filter(r=>r.structure!==null).length;
 const passed=groups.filter(r=>r.structure===true).length;
 return {firstAttempts:groups.length,structureObserved:observed,structureUnobserved:groups.length-observed,structurePassed:passed,structureRate:observed?passed/observed:null,requestStructureRate:groups.length?passed/groups.length:null,contentReviewed:groups.filter(r=>r.review?.kind==='human').length,qualified,qualificationRate:groups.length&&scored.length===groups.length?qualified/groups.length:null};
}
