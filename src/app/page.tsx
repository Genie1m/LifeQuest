import Link from "next/link";
import { ArrowRight, Compass, Flag, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return <div className="page-enter">
    <div className="welcome-line"><span className="eyebrow">YOUR ADVENTURE STARTS HERE</span><span className="stage-badge">STEP 02 · 基础骨架</span></div>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><span className="hero-kicker"><span /> 冒险序章</span><h1 id="hero-title">你的人生，<br />值得一场<span>冒险。</span></h1><p>把现实中的目标，写成自己的成长故事。<br className="desktop-break" />方向由你决定，每一步都属于你。</p><Button asChild><Link href="/onboarding">探索冒险起点<ArrowRight aria-hidden="true" /></Link></Button><span className="hero-disclaimer">角色创建将在 Step 3 开放</span></div>
      <div className="compass-art" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><span className="compass-north">N</span><span className="compass-south">S</span><span className="compass-west">W</span><span className="compass-east">E</span><div className="compass-diamond" /><div className="compass-needle" /><div className="compass-center" /><span className="art-star star-one">✦</span><span className="art-star star-two">✧</span><span className="art-caption">A JOURNEY OF YOUR OWN</span></div>
      <span className="hero-index" aria-hidden="true">CHAPTER / 00</span>
    </section>
    <section className="journey-section" aria-labelledby="journey-heading"><div className="section-heading"><div><span className="eyebrow">THE PATH AHEAD</span><h2 id="journey-heading">成长的旅程，将从这里展开</h2></div><span className="muted-label">后续能力预告 · 尚未实现</span></div><div className="journey-grid">{[
      { number: "01", icon: Shield, title: "建立你的角色", description: "选择冒险身份，让每次行动都成为成长的印记。", href: "/character", label: "角色档案" },
      { number: "02", icon: Flag, title: "选择现实的目标", description: "从一个有意义的成果出发，找到属于你的方向。", href: "/goals", label: "目标日志" },
      { number: "03", icon: Sparkles, title: "规划自己的路径", description: "审阅建议、调整任务，最终计划始终由你决定。", href: "/goals/new", label: "目标起点" },
    ].map(({ number, icon: Icon, title, description, href, label }) => <Card key={number} className="journey-card"><div className="card-top"><span className="feature-icon"><Icon size={23} aria-hidden="true" /></span><span className="card-number">{number}</span></div><h3>{title}</h3><p>{description}</p><Link href={href} className="text-link">{label}<ArrowRight size={15} aria-hidden="true" /></Link></Card>)}</div></section>
    <div className="foundation-note"><Compass size={20} aria-hidden="true" /><p><strong>旅途正在准备中</strong><span>当前可浏览基础页面。角色、目标与任务将在后续阶段逐步开放，尚未生成任何成长数据。</span></p><span className="foundation-tag">FOUNDATION</span></div>
  </div>;
}
