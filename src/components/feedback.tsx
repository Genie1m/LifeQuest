"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/state/AppProvider";

export function LoadingState() {
  return <div className="feedback" role="status"><LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /><div><p className="font-medium">正在读取冒险档案</p><p className="mt-1 text-sm text-muted-foreground">你的数据只保存在当前浏览器。</p></div></div>;
}
export function StorageFeedback() {
  const { status, error, reload } = useAppState();
  if (status === "loading") return <LoadingState />;
  if (!error) return null;
  return <div className="feedback error-feedback" role="alert"><AlertTriangle className="size-5 shrink-0" aria-hidden="true" /><div className="flex-1"><p className="font-medium">本地档案暂时不可用</p><p className="mt-1 text-sm">{error.message}</p></div><Button variant="outline" onClick={() => void reload()}><RefreshCw aria-hidden="true" />重新读取</Button></div>;
}
export function LocalStatus() {
  const { status, error, saving } = useAppState();
  const label = error ? "本地存储异常" : status === "loading" ? "正在读取" : saving ? "正在保存" : "本地存储就绪";
  return <span className="local-status" role="status"><span className={error ? "status-dot error-dot" : "status-dot"} />{label}</span>;
}
