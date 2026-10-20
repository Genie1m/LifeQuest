"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="feedback error-feedback" role="alert"><AlertTriangle aria-hidden="true" /><div><h1 className="text-xl">页面暂时无法显示</h1><p>可以重试。此操作不会清空本地档案。</p></div><Button variant="outline" onClick={reset}>重试页面</Button></div>;
}
