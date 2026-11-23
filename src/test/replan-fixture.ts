import {executionFixture} from './execution-fixtures';
import {completeTask} from '@/domain/execution';
import type {ReplanSettings} from '@/domain/types';
import fixed from '../../tests/evals/replan-5h-to-2h.json';
export function replanFixture(){
 let s=executionFixture();const g=s.goals[0];g.title=fixed.goal;g.successCriteria=fixed.successCriteria;g.weeklyHours=5;
 const done=g.confirmedPlan!.content.stages[0].tasks[0];const tasks=fixed.remaining.map(t=>({id:crypto.randomUUID(),title:t.title,description:'保留可回顾的交付记录',doneCriteria:t.title+'并保存验证结果',estimatedMinutes:t.minutes,difficulty:'standard' as const,status:'pending' as const}));
 g.confirmedPlan!.content.stages[0].tasks=[done,tasks[0]];g.confirmedPlan!.content.stages[1].tasks=tasks.slice(1);
 s=completeTask(s,g.id,done.id,{goal:JSON.stringify(g),confirmed:true}).snapshot;
 const settings:ReplanSettings={weeklyHours:2,windowWeeks:5,feedback:'已完成读取，工作安排变化，每周只能投入2小时',selectedTaskIds:tasks.map(t=>t.id),deferredTaskIds:[tasks[3].id],strategy:'defer'};
 return {s,settings};
}
