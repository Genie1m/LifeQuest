"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Flag, Shield, Sparkles, Sword, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { LocalStatus, StorageFeedback } from "./feedback";

const navigation = [
  { href: "/", label: "冒险", english: "Adventure", icon: Compass },
  { href: "/goals", label: "目标", english: "Quests", icon: Flag },
  { href: "/character", label: "角色", english: "Character", icon: Shield },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="LifeQuest 冒险首页"><span className="brand-mark"><Sword aria-hidden="true" /></span><span>LifeQuest<span className="brand-caption">MAKE LIFE AN ADVENTURE</span></span></Link>
      <div className="nav-label">你的冒险地图 <span>01</span></div>
      <nav aria-label="主要导航" className="navigation">{navigation.map(({href, label, english, icon: Icon}) => {
        const active = href === "/" ? pathname === "/" || pathname === "/onboarding" : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-item ${active ? "is-active" : ""}`}><Icon size={19} aria-hidden="true" /><span>{label}<small>{english}</small></span>{active && <span className="nav-gem" aria-hidden="true">◆</span>}</Link>;
      })}</nav>
      <div className="sidebar-bottom"><Sparkles size={20} aria-hidden="true" /><p>每一次行动，<br />都在塑造你的角色。</p><div className="sidebar-rule" /><span>本机冒险者</span><small>档案仅保存在当前浏览器</small></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="chapter-label"><span className="chapter-dot" />序章 <span className="topbar-separator">/</span> 冒险的起点</div><LocalStatus /></header>
      <main id="main-content" tabIndex={-1}><StorageFeedback />{children}</main>
      <footer className="footer"><span>LifeQuest · 将成长写成你的故事</span><span>演示规划器，未接入真实 AI <ArrowUpRight size={13} aria-hidden="true" /></span></footer>
    </div>
  </div>;
}
