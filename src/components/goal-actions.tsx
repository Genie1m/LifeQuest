"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSnapshot, Goal } from "@/domain/types";
import { DomainError, pauseGoal, resumeGoal, setFocusGoal } from "@/domain/commands";
import { useAppState } from "@/state/AppProvider";
import { Button } from "./ui/button";

export function GoalActions({ goal }: { goal: Goal }) {
  const { snapshot, save, saving, blocked } = useAppState();
  const router = useRouter();
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const lock = useRef(false);
  const focused = snapshot?.focusGoalId === goal.id;
  async function run(command: (s: AppSnapshot) => AppSnapshot, success: string, href?: string) {
    if (lock.current || saving || blocked) return;
    lock.current = true; setPending(true); setMessage("");
    try {
      const ok = await save(command);
      setMessage(ok ? success : "尚未保存，状态保持不变。请检查存储提示后重试。");
      if (ok && href) router.push(href);
    }
    catch (error) { setMessage(error instanceof DomainError ? error.message : "操作失败，请重试。"); }
    finally { lock.current = false; setPending(false); }
  }
  if (goal.status !== "active" && goal.status !== "paused") return null;
  return <div className="goal-actions" aria-busy={pending}><div className="action-row">
    {goal.status === "active" && <><Button variant="outline" disabled={pending || saving || blocked} onClick={() => void run(s => setFocusGoal(s, focused ? undefined : goal.id), focused ? "已取消重点。" : "已设为当前重点。")}>{focused ? "取消重点" : "设为重点"}</Button><Button variant="ghost" disabled={pending || saving || blocked} onClick={() => void run(s => pauseGoal(s, goal.id), "已暂停，计划与成长记录已保留。")}>暂停冒险</Button></>}
    {goal.status === "paused" && <Button variant="outline" disabled={pending || saving || blocked} onClick={() => void run(s => resumeGoal(s, goal.id), "已恢复冒险；如有修订草稿，请先继续规划。", goal.draft ? `/goals/${goal.id}/plan` : undefined)}>恢复冒险</Button>}
  </div>{message && <p role="status" className="action-feedback">{message}</p>}</div>;
}
