import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProvider } from "@/state/AppProvider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = { title: { default: "LifeQuest · 让成长成为冒险", template: "%s · LifeQuest" }, description: "AI 辅助规划，用户自主决策。将现实目标转化为自己的成长冒险。当前为基础骨架。" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body><AppProvider><AppShell>{children}</AppShell></AppProvider></body></html>;
}
