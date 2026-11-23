"use client";

import Link from "next/link";
import {useState} from 'react';
import { visualAvatar } from "@/domain/commands";
import { ProfessionConfirmation } from "./profession-confirmation";
import { useAppState } from "@/state/AppProvider";
import { characterGrowth } from "@/domain/progression";
import { characterVocation, DIRECTIONS } from "@/domain/catalog";
import { CharacterArtwork } from "./artwork";

export function CharacterPanel({ full = false }: { full?: boolean }) {
  const [motion,setMotion]=useState(true);
  const { snapshot } = useAppState();
  const character = snapshot?.character;
  if (!snapshot || !character) return null;
  const vocation = characterVocation(visualAvatar(character));
  const growth = characterGrowth(character.id, snapshot.completions);
  return <section className={`quest-card character-panel ${full ? "character-full-panel" : ""} ${motion?'companion-motion':''} ${growth.level>=2?'companion-awakened':''}`} data-vocation={vocation?.id}>
    <div className={full ? "character-profile-layout" : vocation?"character-dashboard-layout":""}>
      {!full&&vocation&&<div className="companion-stand"><span className="eyebrow">YOUR COMPANION</span><CharacterArtwork avatarId={visualAvatar(character)} eager/><span className="companion-level">Lv.{growth.level} · {growth.level>=2?'成长光环':'冒险起步'}</span></div>}
      {full && <div className="profile-illustration"><div className="preview-topline"><span>CHARACTER PORTRAIT</span><span>{vocation ? "当前 · 基础外观 A" : "旧版形象"}</span></div><div className="character-stage"><span className="stage-orbit orbit-one" aria-hidden="true" /><CharacterArtwork avatarId={visualAvatar(character)} eager /></div></div>}
      <div className="profile-summary">
        <div className="character-identity">
          {!full && <span className="role-avatar"><CharacterArtwork avatarId={visualAvatar(character)} kind="portrait" eager /></span>}
          <div><span className="eyebrow">{vocation?.english ?? "本机冒险者"}</span><h2 className="wrap-text">{character.name}</h2><p className="vocation-identity">{vocation?.name ?? "旧版形象 · 职业尚未确认"}</p><p>Lv.{growth.level} · {growth.level === 1 ? "初级冒险者" : "冒险者"}</p></div>
          <strong className="xp-total">{growth.totalXp} <small>XP</small></strong>
        </div>
        {full && (vocation ? <div className="profile-lore"><p className="class-personality">{vocation.personality}</p><blockquote>“{vocation.quote}”</blockquote><p>{vocation.background}</p><dl><div><dt>随身道具</dt><dd>{vocation.props}</dd></div><div><dt>未来挑战预览</dt><dd>{vocation.challenge} · 尚未实现</dd></div><div><dt>收藏品预览</dt><dd>{vocation.collection} · 尚未开放</dd></div></dl></div> : <p className="local-notice legacy-notice">你的原有角色与成长记录已保留。你可以主动确认职业，继续使用同一个角色和全部成长记录。</p>)}
        <div className="xp-caption"><span>再获得 {100-growth.levelProgress} XP 升级</span><span>{growth.levelProgress} / 100 XP</span></div><progress className="xp-track" max={100} value={growth.levelProgress} aria-label="当前等级经验进度" />
        <div className="ability-grid">{DIRECTIONS.map(d => <div key={d.id}><span>{d.name}</span><strong>{growth.abilities[d.id]}</strong><small>方向经验</small></div>)}</div>
        <p className="field-hint">能力经验记录真实任务的投入，不代表能力的客观测量。创建角色和目标不会获得经验。</p>
      </div>
    </div>
    {vocation&&<div className="companion-controls"><button type="button" className="text-link" aria-pressed={motion} onClick={()=>setMotion(v=>!v)}>{motion?'关闭角色动效':'开启角色动效'}</button><span>Lv.2 点亮成长光环 · 尊重系统减少动态效果设置</span></div>}
    {!character.classId && (full ? <ProfessionConfirmation /> : <Link href="/character" className="text-link">确认我的冒险职业 →</Link>)}
    {full && vocation && <section className="appearance-roadmap" aria-labelledby="appearance-heading"><h3 id="appearance-heading">故事会继续，外观也会成长</h3><p>当前为基础外观 A，Lv.2 起点亮 CSS 成长光环。进阶 B 与精英 C 的新服饰尚未制作或解锁，光环不代表已更换外观。</p></section>}
  </section>;
}
