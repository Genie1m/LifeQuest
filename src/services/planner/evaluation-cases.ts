import type {PlanningInput} from "@/domain/proposal";
/** Fixed inputs only. Real output/quality/usage must be measured, never filled from Mock. */
export const EVALUATION_CASES:PlanningInput[]=[
 {title:"零基础学习 Python",baseline:"没有编程经验",successCriteria:"独立完成一个读取CSV并生成统计结果的脚本",direction:"knowledge",weeklyHours:3,preferences:"实践优先",constraints:"只有普通电脑，不购买课程",requirements:"每一步能独立检查结果"},
 {title:"完成 AI Agent 项目",baseline:"能编写基础 Python，还没有发布产品",successCriteria:"交付一个有三份测试用例和演示说明的工具调用原型",direction:"creativity",weeklyHours:5,preferences:"先做最小原型",constraints:"不购买额外服务",requirements:"明确工具边界和失败行为"},
 {title:"准备职业面试",baseline:"已有简历，没有系统练习",successCriteria:"完成一次五题模拟面试并记录逐题改进点",direction:"social",weeklyHours:2,preferences:"口头演练",constraints:"无面试教练",requirements:"不要编造我的行业和工作经历"},
 {title:"建立运动习惯",baseline:"目前没有稳定锻炼习惯",successCriteria:"形成一份自己能够持续执行并记录的低门槛活动计划",direction:"vitality",weeklyHours:1,preferences:"循序渐进",constraints:"未提供健康状况，不做医疗判断",requirements:"不假定我有健身房或运动装备"},
 {title:"完成摄影作品集",baseline:"会手机摄影，还没有主题作品",successCriteria:"整理12张主题照片并写下选片理由",direction:"creativity",weeklyHours:4,preferences:"拍摄实践和作品回顾",constraints:"仅用现有手机",requirements:"避免重复的空泛学习任务"},
];
