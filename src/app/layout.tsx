import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModelSessionProvider } from "@/state/ModelSession";
import { AppProvider } from "@/state/AppProvider";
import { AppShell } from "@/components/app-shell";
import { SessionGate } from "@/components/session-gate";
import "./globals.css";
import "./forms.css";
import "./characters.css";
import "./quests.css";
import "./editor.css";
import "./execution.css";

export const metadata: Metadata = { title: { default: "LifeQuest · 让成长成为冒险", template: "%s · LifeQuest" }, description: "创建冒险角色与现实成长目标，审核规划建议，由你决定成长的方向。当前进度保存在本机浏览器。" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><ModelSessionProvider><AppProvider><AppShell><SessionGate>{children}</SessionGate></AppShell></AppProvider></ModelSessionProvider></body></html>;
}
