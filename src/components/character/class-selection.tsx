"use client";

import { AVATARS, characterVocation } from "@/domain/catalog";
import { CharacterArtwork } from "./artwork";

export function ClassSelection({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const current = characterVocation(value) ?? AVATARS[0];
  return <div className="class-selection">
    <fieldset className="class-list" tabIndex={-1} aria-invalid={!!error} aria-describedby="class-help avatarId-error">
      <legend>选择你的冒险职业 <span>（必选）</span></legend>
      <p id="class-help" className="field-hint">选择你喜欢的成长姿态。所有职业均可创建任意方向的目标，XP 规则相同。</p>
      {AVATARS.map((vocation, index) => <label key={vocation.id} className="class-option" data-vocation={vocation.id}>
        <input type="radio" name="avatar" value={vocation.id} checked={value === vocation.id} onChange={() => onChange(vocation.id)} required aria-label={vocation.name} />
        <span className="class-option-copy">
          <span className="class-option-heading"><strong>{vocation.name}</strong><span className="class-choice-state">{value === vocation.id ? "已选择" : `0${index + 1}`}</span></span>
          <span className="class-english">{vocation.english}</span>
          <span className="class-personality">{vocation.personality}</span>
          <q>{vocation.quote}</q>
          <span className="class-preview-meta">未来挑战 · {vocation.challenge}<br />收藏预览 · {vocation.collection}</span>
        </span>
      </label>)}
      {error && <p className="field-error" id="avatarId-error">{error}</p>}
    </fieldset>
    <section className="class-preview" data-vocation={current.id} aria-labelledby="class-preview-name">
      <div className="preview-topline"><span>THE ADVENTURER</span><span>基础外观 A</span></div>
      <div className="character-stage"><span className="stage-orbit orbit-one" aria-hidden="true" /><span className="stage-orbit orbit-two" aria-hidden="true" /><CharacterArtwork avatarId={current.id} eager /></div>
      <div className="class-preview-copy">
        {!value && <span className="preview-only">当前为预览，请选择职业以确认</span>}
        <span className="class-english">{current.english}</span>
        <h2 id="class-preview-name">{current.name}</h2>
        <p>{current.description}</p><p className="class-background">{current.background}</p>
        <p className="class-props">{current.props}</p>
      </div>
    </section>
  </div>;
}
