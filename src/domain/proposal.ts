import type { AppSnapshot, Direction, PlanContent } from "./types";
import { DomainError } from "./commands";
import { planIssues } from "./editor";
import { parseSnapshot } from "./validation";

export interface PlanningInput { title: string; successCriteria: string; baseline: string; direction: Direction; weeklyHours: number; preferences: string; constraints: string; requirements: string; currentPlan?:string; replanContext?:string }
export interface ProposalTask { ref: string; title: string; description: string; doneCriteria: string; estimatedMinutes: number; difficulty: "light" | "standard" | "challenge" }
export interface PlanProposal { reasoning: string; assumptions: string[]; warnings: string[]; stages: { ref: string; title: string; milestone: string; checkpointRef: string; tasks: ProposalTask[] }[] }
type Schema = { type: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; enum?: string[];pattern?:string };
export interface ProposalIssue {path:string;rule:string}
export class ProposalValidationError extends DomainError {
 constructor(public readonly issue:ProposalIssue){super('invalid-input',`模型格式错误：${issue.path}：${issue.rule}。未导入，原草稿未改变。`);}
}
const str = (max: number, min = 1): Schema => ({ type: "string", minLength: min, maxLength: max });
const obj = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: Schema, minItems: number, maxItems: number): Schema => ({ type: "array", items, minItems, maxItems });
const ref=():Schema=>({...str(40),pattern:'^[A-Za-z][A-Za-z0-9_-]{0,39}$'});
export const PROPOSAL_SCHEMA = obj({ reasoning: str(1500), assumptions: array(str(300),0,6), warnings: array(str(300),0,6), stages: array(obj({ref:ref(),title:str(80),milestone:str(500),checkpointRef:ref(),tasks:array(obj({ref:ref(),title:str(80),description:str(500,0),doneCriteria:str(500),estimatedMinutes:{type:"integer",minimum:5,maximum:600},difficulty:{type:"string",enum:["light","standard","challenge"]}}),1,50)}),1,10) });
export function validateShape(value: unknown, schema: Schema, path = "proposal"): void {
  const invalid = (rule:string):never => { throw new ProposalValidationError({path,rule}); };
  if(schema.type==='object'){
   if(!value||typeof value!=='object'||Array.isArray(value))return invalid('必须是JSON对象');
   const v=value as Record<string,unknown>;const missing=schema.required!.find(k=>!Object.hasOwn(v,k));
   if(missing)throw new ProposalValidationError({path:`${path}.${missing}`,rule:'缺少必填字段'});
   if(Object.keys(v).some(k=>!Object.hasOwn(schema.properties!,k)))return invalid('包含未声明字段；不允许XP、系统ID、完成状态或额外包装字段');
   for(const [k,s] of Object.entries(schema.properties!))validateShape(v[k],s,`${path}.${k}`);
  }else if(schema.type==='array'){
   if(!Array.isArray(value))return invalid('必须是数组');
   if(value.length<schema.minItems!||value.length>schema.maxItems!)return invalid(`数组数量必须为${schema.minItems}～${schema.maxItems}`);
   value.forEach((v,i)=>validateShape(v,schema.items!,`${path}[${i}]`));
  }else if(schema.type==='string'){
   if(typeof value!=='string')return invalid('必须是字符串，不能为null或数字');
   if((schema.minLength&&!value.trim())||value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity))return invalid(`文本长度必须为${schema.minLength??0}～${schema.maxLength??'不限'}个字符，必填内容不能空白`);
   if(schema.enum&&!schema.enum.includes(value))return invalid(`只能取${schema.enum.join(' / ')}`);
   if(schema.pattern&&!new RegExp(schema.pattern).test(value))return invalid('临时引用须为字母开头、最多40位的字母/数字/下划线/横线');
  }else if(schema.type==='integer'&&(typeof value!=='number'||!Number.isInteger(value)||value<schema.minimum!||value>schema.maximum!))return invalid(`必须为${schema.minimum}～${schema.maximum}的整数`);
}
export function parseProposal(raw: unknown): PlanProposal {
  if(raw&&typeof raw==='object'&&'type' in raw&&'properties' in raw)throw new ProposalValidationError({path:'proposal',rule:'返回了JSON Schema定义，需要的是符合该Schema的计划JSON实例'});
  validateShape(raw,PROPOSAL_SCHEMA);const proposal=raw as PlanProposal;const refs=new Set<string>();let total=0;
  for(const [i,s] of proposal.stages.entries()){
   const entries=[{ref:s.ref,path:`proposal.stages[${i}].ref`},...s.tasks.map((t,j)=>({ref:t.ref,path:`proposal.stages[${i}].tasks[${j}].ref`}))];
   for(const item of entries){if(refs.has(item.ref))throw new ProposalValidationError({path:item.path,rule:'临时引用重复；章节与任务的ref须在整份计划中唯一'});refs.add(item.ref);}
   if(!s.tasks.some(t=>t.ref===s.checkpointRef))throw new ProposalValidationError({path:`proposal.stages[${i}].checkpointRef`,rule:'检查点必须等于本章节一项任务的ref，不能指向章节或其他章节任务'});total+=s.tasks.length;
  }
  if(total>50)throw new ProposalValidationError({path:'proposal.stages',rule:'整份计划的任务合计不能超过50项'});return proposal;
}
export interface ProposalBaseline { goalId: string; revision: number; goal: string }
/** Only creates editor content. Persistence and activation remain explicit user actions. */
export function importProposal(snapshot: AppSnapshot, baseline: ProposalBaseline, raw: unknown, id = () => crypto.randomUUID()): PlanContent {
  parseSnapshot(snapshot);const g=snapshot.goals.find(g=>g.id===baseline.goalId);
  if(!g||g.status!=="draft"||!g.draft||snapshot.revision!==baseline.revision||JSON.stringify(g)!==baseline.goal)throw new DomainError("invalid-input","此建议已过期或目标不再可编辑，请重新生成。");
  const content=proposalContent(raw,id);
  if(planIssues(content,true).length)throw new DomainError("invalid-input","建议未通过计划就绪校验。");
  parseSnapshot({...snapshot,goals:snapshot.goals.map(goal=>goal.id===g.id?{...g,draft:{...g.draft!,content}}:goal)});return content;
}
export function proposalContent(raw:unknown,id=()=>crypto.randomUUID()):PlanContent {
 const p=parseProposal(raw);const content:PlanContent={stages:p.stages.map(s=>{const mapping=new Map(s.tasks.map(t=>[t.ref,id()]));return {id:id(),title:s.title,milestone:s.milestone,checkpointTaskId:mapping.get(s.checkpointRef),tasks:s.tasks.map(t=>({id:mapping.get(t.ref)!,title:t.title,description:t.description,doneCriteria:t.doneCriteria,estimatedMinutes:t.estimatedMinutes,difficulty:t.difficulty,status:'pending'}))};})};
 if(planIssues(content,true).length)throw new DomainError('invalid-input','建议未通过计划就绪校验。');return content;
}
