import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return <div className="placeholder-card"><span className="eyebrow">OFF THE MAP · 404</span><h1>这条路还没有出现在地图上</h1><p>页面不存在，你可以返回冒险首页。</p><Button asChild><Link href="/">返回冒险</Link></Button></div>;
}
