import {estimateWork} from './plan-estimates';
import type {PlanProposal, PlanningInput} from './proposal';

export const PLAN_REVIEW_VERSION = 'plan-review-v2';
export const RECOMMENDED_SESSION_MINUTES = 60;
export type QualityCode = 'estimate-mismatch' | 'checkpoint-order' | 'long-session' | 'failure-as-delivery' | 'forced-defect' | 'session-window' | 'bundled-outputs' | 'coverage-count' | 'practice-window';
export interface QualityIssue {
  code: QualityCode; category: 'acceptance' | 'sessions' | 'coverage' | 'sequence' | 'time';
  message: string; suggestion: string; stageRef?: string; taskRef?: string;
}
export interface CoverageRequirement {source: 'successCriteria' | 'requirements' | 'preferences' | 'constraints'; label: string; text: string}
const reportedTotals = /(?:合计|合共|总(?:预计)?(?:时长|耗时|工作量)?(?:约需|预计|为|是)?|共计|预计总(?:时长|耗时)?|计划(?:共|约需|需|总计))\s*(?:约)?\s*(\d+(?:\.\d+)?)\s*(分钟|小时)/gu;
const fallbackAsEvidence = /(?:若|如果|如遇|如未|如无|如无法|无法|未能|未通过|未完成|不成功|失败|或)[^。！？；\n]{0,55}(?:如实记录|记录|注明|标注|说明|保存)[^。！？；\n]{0,25}(?:原因|失败|错误|报错|受阻|未完成|缺口|限制|改期)/u;
const unresolvedAsEvidence = /(?:未通过|未解决|待补拍|未覆盖)[^。！？；\n]{0,30}(?:标注|标记|注明|说明|下一步|后续)|(?:标注|标记|注明)[^。！？；\n]{0,20}(?:未通过|未解决|待补拍)/u;
const diagnosisOnly = /^(?:诊断|盘点|排查|分析|回顾|复盘|整理[^。]{0,12}(?:问题|记录|清单))/u;
const implementation = /实现|开发|修复|集成|交付|完成.*(?:程序|功能|作品集)|最终/u;
const healthyBranch = /未(?:发现|出现).{0,12}(?:问题|错误|缺陷)|没有.{0,8}(?:问题|错误|缺陷)|无需(?:修复|修改|调整)|(?:全部|均)(?:测试)?通过|若无(?:错误|问题|缺陷)/u;

export function reviewRequirements(input?: Partial<PlanningInput>): CoverageRequirement[] {
  const sources = [['successCriteria','最终成功标准'],['requirements','补充要求与周期'],['preferences','执行偏好'],['constraints','条件与资源']] as const;
  return sources.flatMap(([source,label]) => input?.[source]?.trim() ? [{source,label,text:input[source]!.trim()}] : []);
}
function quantity(text: string) {
  if (/^\d+$/.test(text)) return Number(text);
  const digits: Record<string, number> = {零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  let total=0, digit=0;
  for(const ch of text){if(ch==='十'||ch==='百'){total+=(digit||1)*(ch==='十'?10:100);digit=0;}else if(ch in digits)digit=digits[ch];else return NaN;}
  return total+digit;
}
const number = '[0-9一二两三四五六七八九十百]+';
function practiceWindow(input?: Partial<PlanningInput>) {
  const match=(input?.requirements??'').match(new RegExp(`(?:实践|试行|观察|持续|连续|执行)\\s*(${number})\\s*周`,'u'));
  const weeks=match?quantity(match[1]):NaN;
  return weeks>1&&weeks<=52?weeks:null;
}
function explicitSession(input?: Partial<PlanningInput>) {
  const match = `${input?.preferences??''}；${input?.constraints??''}`.match(new RegExp(`(?:每次|单次|每个时段)(?:约|最多|不超过|仅)?\\s*(${number})\\s*(分钟|小时)`,'u'));
  if(!match) return null;
  const minutes=quantity(match[1])*(match[2]==='小时'?60:1);
  return minutes>=5&&minutes<=600?minutes:null;
}

/** Advisory evidence, never a semantic pass/fail score or a reason to modify a proposal. */
export function proposalReview(proposal: PlanProposal, weeklyHours: number, mode: boolean | 'initial' | 'chapters' | 'tasks' = false, input?: Partial<PlanningInput>) {
  const taskOnly=mode===true||mode==='tasks';
  const wholePlan=mode===false||mode==='initial';
  const tasks = proposal.stages.flatMap(stage => stage.tasks);
  const estimate = estimateWork(tasks, weeklyHours);
  const issues: QualityIssue[] = [];
  const add = (issue: QualityIssue) => {if(!issues.some(i=>i.code===issue.code&&i.taskRef===issue.taskRef&&i.message===issue.message))issues.push(issue);};
  const session = explicitSession(input);
  if (!taskOnly && estimate.minutes !== null) {
    for (const reason of [proposal.reasoning,...proposal.assumptions,...proposal.warnings]) {
      for (const match of reason.matchAll(reportedTotals)) {
        const minutes = Number(match[1]) * (match[2] === '小时' ? 60 : 1);
        if (Math.abs(minutes-estimate.minutes)>=5) add({code:'estimate-mismatch',category:'time',message:`说明提到「${match[0]}」，逐项相加为 ${estimate.minutes} 分钟。请按实际任务核对差异。`,suggestion:'以逐项工作量为依据，另留等待与返工时间。'});
      }
    }
  }
  for (const stage of proposal.stages) {
    const checkpoint = stage.tasks.findIndex(task => task.ref === stage.checkpointRef);
    if (!taskOnly && checkpoint>=0 && checkpoint<stage.tasks.length-1) add({code:'checkpoint-order',category:'sequence',stageRef:stage.ref,taskRef:stage.checkpointRef,message:`「${stage.title}」的检查点后还有 ${stage.tasks.length-checkpoint-1} 项任务。若它们是里程碑所需交付，请把检查点设在最终交付或核验任务。`,suggestion:'先完成本章必需工作再核验；若后面只是可选练习，请明确说明。'});
    for (const task of stage.tasks) {
      const at = {stageRef:stage.ref,taskRef:task.ref};
      if(task.estimatedMinutes>RECOMMENDED_SESSION_MINUTES)add({...at,code:'long-session',category:'sessions',message:`「${task.title}」预计 ${task.estimatedMinutes} 分钟。请核对是否一次可完成。`,suggestion:taskOnly?'保留原任务标识，明确各次行动和暂停位置；不要只缩短分钟数。':'若包含多次工作或多个成果，拆成独立任务，分别填写估时和验收。'});
      if(session!==null&&task.estimatedMinutes>session)add({...at,code:'session-window',category:'sessions',message:`「${task.title}」预计 ${task.estimatedMinutes} 分钟，超过你填写的单次 ${session} 分钟。`,suggestion:taskOnly?'核对能否在原任务内安排多次行动，保留引用与难度。':'按实际可用时段拆分；若这是允许的周末长时段，请核对例外。'});
      const bundled=task.title.match(new RegExp(`(${number})组|其余[${'一二两三四五六七八九十0-9'}]*组|五组|多组|各组`,'u'));
      if(!taskOnly&&bundled&&(!bundled[1]||quantity(bundled[1])>1)&&/拍摄|补拍|编辑|后期|训练|制作/u.test(task.title)&&task.estimatedMinutes>(session??60))add({...at,code:'bundled-outputs',category:'sessions',message:`「${task.title}」合并了多组制作工作，请逐组核对可执行性。`,suggestion:'逐组安排制作、筛选或处理；不把整批工作当成一个进度勾选项。'});
      const isDiagnosis=diagnosisOnly.test(task.title.trim())&&!implementation.test(task.title);
      if((fallbackAsEvidence.test(task.doneCriteria)||unresolvedAsEvidence.test(task.doneCriteria))&&!isDiagnosis)add({...at,code:'failure-as-delivery',category:'acceptance',message:`「${task.title}」的完成标准可能把失败、缺口或改期记录当作交付。`,suggestion:'把受阻处理放在行动中；完成标准要求实际成果及核验结果。练习只需实际完成并复盘，诊断可以交付报告。'});
      const demandsDefect=/复现并修复|修复一[个项次]|(?:一个|一项|一次|至少1个|至少一项)(?:实际|真实)?(?:调试)?(?:错误|缺陷)|错误现象[—\-－]原因[—\-－]修复/u.test(`${task.title}。${task.description}。${task.doneCriteria}`);
      if(demandsDefect&&!healthyBranch.test(`${task.description}。${task.doneCriteria}`))add({...at,code:'forced-defect',category:'acceptance',message:`「${task.title}」要求发现或修复错误，未说明检查全部通过时如何完成。`,suggestion:'有缺陷则修复并复测；没有缺陷则保存通过证据或验证预设异常输入。'});
    }
  }
  const requirements=reviewRequirements(input);
  // Only surface explicit quantities. No lexical match can prove semantic coverage.
  if(wholePlan&&input){
    const final=tasks.at(-1)?.doneCriteria??'';
    for(const match of (input.successCriteria??'').matchAll(new RegExp(`(${number})\\s*(组|篇|份|个)([^，。；]{0,12})`,'gu'))){
      const n=quantity(match[1]);if(!Number.isFinite(n)||n<2)continue;
      const same=[...final.matchAll(new RegExp(`(${number})\\s*${match[2]}`,'gu'))].some(m=>quantity(m[1])===n);
      if(!same)add({code:'coverage-count',category:'coverage',message:`最终成功标准要求「${match[0]}」，末项验收未明确复核这个数量。`,suggestion:'逐个核对完整成果及展示；数量表述不同也可能正确，请结合全部任务确认。'});
    }
    const weeks=practiceWindow(input);
    if(weeks!==null){
      const text=proposal.stages.map(s=>`${s.title}。${s.milestone}。${s.tasks.map(t=>`${t.title}。${t.description}。${t.doneCriteria}`).join('。')}`).join('。');
      const observed=new Set<number>();
      for(const m of text.matchAll(new RegExp(`第\\s*(${number})(?:\\s*[至到—–-]\\s*(${number}))?\\s*周`,'gu'))){const a=quantity(m[1]),z=m[2]?quantity(m[2]):a;if(z>=a&&z-a<=52)for(let w=a;w<=z;w++)observed.add(w);}
      const missing=Array.from({length:weeks},(_,i)=>i+1).filter(w=>!observed.has(w));
      if(missing.length)add({code:'practice-window',category:'coverage',message:`你要求实践 ${weeks} 周，计划未明确标出第 ${missing.join('、')} 周的执行证据。`,suggestion:'检查每周实际行动和记录；总分钟推算的周数不能代替观察周期，也不能以缺记录的回顾代替实践。'});
    }
  }
  return {version:PLAN_REVIEW_VERSION,tasks,issues,warnings:issues.map(i=>i.message),requirements,practiceWindowWeeks:wholePlan?practiceWindow(input):null,scope:taskOnly?'selected-tasks':wholePlan?'plan':'editable-chapters',semanticStatus:'needs-user-review' as const};
}
