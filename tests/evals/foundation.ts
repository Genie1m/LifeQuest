import type {EvalCase} from './cases';

// Independent addition: the initial 12-case dataset and rubric remain frozen.
export const FOUNDATION_VERSION='lifequest-foundation-1.0.0';
export const REPEATS=4;
const scenarios=[
 {id:'A',name:'编程学习',title:'学习 Python',hours:5,direction:'knowledge',success:'能够独立完成一个基础数据处理程序',constraint:'使用普通电脑和免费资源；明确输入、处理和输出，不假定已有编程能力。',levels:['没有编程经验','了解变量、循环和函数，尚未完成独立程序','能写函数、读取 CSV，已做过两个小脚本，需要补齐独立交付与测试']},
 {id:'B',name:'AI 项目实践',title:'完成一个文献助手 Agent',hours:8,direction:'creativity',success:'能够完成文献读取、问答、引用展示和基本测试',constraint:'使用公开样例文献和合法免费资源；引用须可追溯，明确失败行为，不编造文献，不擅自删减成功标准。',levels:['没有编程和 Prompt 经验','了解 Python 和基础 Prompt','已完成单篇文献读取与简单问答原型，缺少引用展示和基本测试']},
 {id:'C',name:'面试准备',title:'准备教师资格面试',hours:5,direction:'social',success:'能够完成结构化问答及模拟试讲，并记录改进点',constraint:'未提供地区和日期；不得编造最新考试规定、地区要求或考试日期；先核实适用官方要求。',levels:['没有面试准备经验，不熟悉基本流程','了解基本流程，但缺少系统练习','已有结构化问答和两段模拟试讲录音，尚未形成稳定复盘与改进记录']},
 {id:'D',name:'运动习惯',title:'建立规律运动习惯',hours:3,direction:'vitality',success:'形成可以持续执行并记录的运动安排',constraint:'未提供健康情况；不得虚构疾病或给个体化医学结论；保留休息和适应过程，不假定器材或付费课程。',levels:['运动不规律，没有稳定记录习惯','偶尔散步和做轻量运动，有零散记录','已有规律轻量运动经历，希望改进长期安排和持续记录，不能假定竞技或医学需求']},
 {id:'E',name:'创作实践',title:'完成摄影作品集',hours:6,direction:'creativity',success:'完成五组主题作品并整理为可展示的作品集',constraint:'使用已有器材和免费工具，不假定相机型号、额外预算、已有作品或交付日期。',levels:['刚开始学习摄影，不熟悉拍摄和后期流程','会基本拍摄和后期','已做过主题系列拍摄，能独立后期，但还没有完成五组作品的筛选、叙事和展示']},
] as const;
export const FOUNDATION_CASES: (EvalCase&{scenario:string;level:string})[]=scenarios.flatMap(s=>s.levels.map((baseline,i)=>({
 id:`${s.id}-L${i+1}`,variant:`基础层级${i+1}`,scenario:s.name,level:['初学','基础','进阶'][i],avatarId:'mage' as const,
 input:{title:s.title,baseline,weeklyHours:s.hours,successCriteria:s.success,direction:s.direction,preferences:'',constraints:s.constraint,requirements:'未提供截止日期；明确周期假设，给出具体行动、可交付成果和可验证完成条件。'}
})));
// Four interleaved rounds, same fixed order; no cherry-picking or hidden retries.
export const FOUNDATION_SLOTS=Array.from({length:REPEATS},(_,r)=>FOUNDATION_CASES.map(c=>({slotId:`${c.id}-R${r+1}`,caseId:c.id,round:r+1}))).flat();
