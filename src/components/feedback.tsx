"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/state/AppProvider";
import { useState } from "react";

export function LoadingState() {
  return <div className="feedback" role="status"><LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /><div><p className="font-medium">正在读取冒险档案</p><p className="mt-1 text-sm text-muted-foreground">你的数据只保存在当前浏览器。</p></div></div>;
}
export function StorageFeedback() {
  const { status, error, reload, upgrade, saving, blocked, readRaw } = useAppState();
  const [downloadError, setDownloadError] = useState("");
  async function download() {
    try {
      const raw = await readRaw();
      if (raw === null) { setDownloadError("当前没有可下载的主档案原文。"); return; }
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "lifequest-original.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloadError("");
    } catch { setDownloadError("原文读取失败，请保留站点数据并检查浏览器存储权限。"); }
  }
  if (status === "loading" && !error) return <LoadingState />;
  if (!error && status !== "migration-required") return null;
  return <section className="quest-card migration-panel">
    {status === "migration-required" && <><span className="eyebrow">ARCHIVE UPGRADE / 档案升级</span><h2>让原有旅程，通向更多冒险</h2><p>本机旧档案需要从 v1 升级到 v2。角色、目标、计划、日期与 XP 流水全部保留；先保存原文备份，验证成功后再继续。</p><p>请先关闭其他 LifeQuest 标签页，仅在此页升级。备份留在当前浏览器，不等于云端同步。</p><Button disabled={saving || blocked} onClick={() => void upgrade()}>{saving ? "正在备份与升级…" : "升级本机冒险档案"}</Button></>}
    {error && <div className="feedback error-feedback" role="alert"><AlertTriangle className="size-5 shrink-0" aria-hidden="true" /><div className="flex-1"><p className="font-medium">本地档案暂时不可用</p><p className="mt-1 text-sm">{error.message}</p></div></div>}
    <div className="action-row"><Button variant="outline" disabled={saving} onClick={() => void reload()}><RefreshCw aria-hidden="true" />重新读取</Button><Button variant="outline" disabled={saving} onClick={() => void download()}>下载当前主档案原文</Button></div>
    {downloadError && <p role="alert">{downloadError}</p>}
  </section>;
}
export function LocalStatus() {
  const { status, error, saving } = useAppState();
  const label = error ? "本地存储异常" : status === "loading" ? "正在读取" : saving ? "正在保存" : status === "migration-required" ? "档案等待升级" : "本地存储就绪";
  return <span className="local-status" role="status"><span className={error ? "status-dot error-dot" : "status-dot"} />{label}</span>;
}
