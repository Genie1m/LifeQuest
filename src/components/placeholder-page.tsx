"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Compass, Flag, Shield, Sparkles } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { useAppState } from "@/state/AppProvider";

type PageKind = "onboarding" | "goals" | "new-goal" | "goal" | "plan" | "character";
const content = {
  onboarding: { eyebrow: "THE ORIGIN", title: "每段传奇，始于一个名字。", description: "在这里建立你的冒险身份，让现实中的每一步都有迹可循。", section: "角色创建尚未开放", detail: "昵称和内置头像选择将在 Step 3 实现。本页尚未创建或保存任何角色。", step: "STEP 03", icon: Shield },
  goals: { eyebrow: "QUEST JOURNAL", title: "把远方的目标，变成脚下的路。", description: "你的现实目标、阶段成果和行动任务，将在这里连成一段旅程。", section: "目标列表尚未实现", detail: "目前不展示模拟目标。目标创建将在 Step 3 开放，计划编辑将在 Step 4 开放。", step: "STEP 03—04", icon: Flag },
  "new-goal": { eyebrow: "A NEW QUEST", title: "为下一次出发，确定方向。", description: "明确你想完成的现实成果，之后再一起拆解可执行的步骤。", section: "目标创建尚未开放", detail: "目标表单、成长方向与每周投入将在 Step 3 实现。本页不会保存目标。", step: "STEP 03", icon: Flag },
  goal: { eyebrow: "QUEST DETAILS", title: "目标档案", description: "阶段路径与真实任务将在这里呈现。", section: "目标详情尚未实现", detail: "任务查看与执行将在后续阶段开放。", step: "STEP 04—06", icon: Compass },
  plan: { eyebrow: "CHART YOUR PATH", title: "你来决定，怎样走向目标。", description: "建议可以修改，计划由你确认。每次调整，都保留已经完成的行动。", section: "计划编辑器尚未开放", detail: "阶段和任务编辑、预览及确认将在 Step 4 实现；Mock 建议将在 Step 5 接入。", step: "STEP 04—05", icon: Sparkles },
  character: { eyebrow: "YOUR CHARACTER", title: "真实的行动，留下成长的印记。", description: "未来，你可以在这里追溯每一份经验来自哪一次现实中的努力。", section: "角色与成长展示尚未实现", detail: "角色创建将在 Step 3 实现，等级、能力经验与成就将在 Step 6 实现。本页不展示虚假 XP 或等级。", step: "STEP 03 / 06", icon: Shield },
};
export function PlaceholderPage({ kind, goalId }: { kind: PageKind; goalId?: string }) {
  const { status, snapshot, error } = useAppState();
  const page = content[kind]; const Icon = page.icon;
  const missingGoal = Boolean(goalId && status === "ready" && !error && !snapshot?.goals.some(goal => goal.id === goalId));
  return <div className="page-enter">
    <div className="page-heading"><span className="eyebrow">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></div>
    <Card className="placeholder-card"><span className="feature-icon"><Icon aria-hidden="true" size={30} /></span><span className="stage-badge">{page.step} · 未实现</span><h2>{missingGoal ? "未找到这个目标" : page.section}</h2><p>{missingGoal ? "本地档案中不存在该目标，详情与计划操作也尚未开放。请返回目标页面。" : page.detail}</p><div className="placeholder-actions">{kind === "goals" ? <Button asChild><Link href="/goals/new">查看创建入口<ArrowRight aria-hidden="true" /></Link></Button> : <Button asChild variant="outline"><Link href={goalId || kind === "new-goal" ? "/goals" : "/"}><ArrowLeft aria-hidden="true" />{goalId || kind === "new-goal" ? "返回目标" : "返回冒险"}</Link></Button>}</div></Card>
    <p className="scope-note">当前为基础页面预览 · 此页面尚不提供业务操作</p>
  </div>;
}
