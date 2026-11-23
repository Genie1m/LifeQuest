"use client";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "@/state/AppProvider";
import { createCharacter, createGoal, DomainError, type FieldErrors } from "@/domain/commands";
import type { AppSnapshot } from "@/domain/types";
import { DIRECTIONS } from "@/domain/catalog";
import { Button } from "./ui/button";
import { ClassSelection } from "./character/class-selection";
import { PageHeading } from "./quest-ui";

export function useCommandForm(form: RefObject<HTMLFormElement | null>) {
  const state = useAppState(); const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  const lock = useRef(false); const [validationAttempt, setValidationAttempt] = useState(0);
  useEffect(() => { if (validationAttempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [validationAttempt, form]);
  async function submit(command: (snapshot: AppSnapshot) => AppSnapshot) {
    if (lock.current || state.saving || state.blocked) return false;
    lock.current = true; setPending(true); setErrors({}); setMessage("");
    try {
      const ok = await state.save(command);
      if (!ok) setMessage("尚未保存，请检查上方存储提示后重试。已填写内容会保留。");
      return ok;
    } catch (error) {
      if (error instanceof DomainError) { setErrors(error.fields); setMessage(error.message); setValidationAttempt(n => n + 1); }
      else setMessage("创建失败，请重试。已填写内容会保留。");
      return false;
    } finally { lock.current = false; setPending(false); }
  }
  function clearError(name: string) { setMessage(""); setErrors(previous => { if (!previous[name]) return previous; const next = { ...previous }; delete next[name]; return next; }); }
  return { errors, clearError, message, pending, submit, disabled: pending || state.saving || state.blocked };
}
function FieldError({ name, errors }: { name: string; errors: FieldErrors }) {
  return errors[name] ? <span id={`${name}-error`} className="field-error">{errors[name]}</span> : null;
}
export function OnboardingForm() {
  const { snapshot } = useAppState();
  const router = useRouter();
  const creating = useRef(false);
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const form = useCommandForm(formRef);
  useEffect(() => {
    if (snapshot?.character && !creating.current) router.replace("/");
  }, [snapshot?.character, router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creating.current) return;
    creating.current = true;
    const ok = await form.submit(current => createCharacter(current, { name, avatarId }));
    if (ok) router.replace("/?welcome=1");
    else creating.current = false;
  }
  if (snapshot?.character) return <p role="status">冒险者已就绪，正在进入大厅…</p>;
  return <>
    <PageHeading eyebrow="CHOOSE YOUR PATH / 序章" title="你的故事，从此有了主角">创建你的冒险角色，将现实中的每一次成长转化为新的冒险。</PageHeading>
    <form className="character-creation" ref={formRef} onSubmit={submit} noValidate aria-busy={form.pending}>
      <ClassSelection value={avatarId} onChange={id => { setAvatarId(id); form.clearError("avatarId"); }} error={form.errors.avatarId} />
      <section className="quest-card naming-panel">
        <div><span className="eyebrow">NAME YOUR ADVENTURER</span><h2>写下你的冒险之名</h2><p>不必准备好一切，先从属于你的名字开始。</p></div>
        <div className="field"><label htmlFor="name">冒险者昵称 <span>（必填）</span></label>
          <input id="name" value={name} onChange={e => { setName(e.target.value); form.clearError("name"); }} required autoComplete="nickname" placeholder="例如：追光者" aria-invalid={!!form.errors.name} aria-describedby="name-help name-error" />
          <small id="name-help">1～20 个字符，保存时会去掉首尾空格。</small><FieldError name="name" errors={form.errors} />
        </div>
        <div className="creation-submit"><Button type="submit" disabled={form.disabled}>{form.pending ? "正在保存角色…" : "创建冒险者"}</Button><span>Lv.1 · 初级冒险者<br />从真实行动开始积累成长</span></div>
        <p className="local-notice">当前版本的进度保存在本机浏览器中，尚未提供账号同步。</p>
        {form.message && <p role="alert" className="field-error">{form.message}</p>}
      </section>
    </form>
  </>;
}
export function GoalCreationForm() {
  const { snapshot } = useAppState(); const router = useRouter(); const formRef = useRef<HTMLFormElement>(null); const form = useCommandForm(formRef);
  const [values, setValues] = useState({ title: "", successCriteria: "", baseline: "", weeklyHours: "", direction: "" });
  const created = useRef(false);
  const active = snapshot?.goals.filter(g => g.status === "active") ?? [];
  async function submit(event: FormEvent) {
    event.preventDefault(); if (created.current) return; let id = "";
    const ok = await form.submit(current => { const next = createGoal(current, { ...values, weeklyHours: Number(values.weeklyHours) }); id = next.goals.at(-1)!.id; return next; });
    if (ok) { created.current = true; router.push(`/goals/${id}/plan`); }
  }
  return <><Link className="text-link" href="/goals">← 返回目标列表</Link><PageHeading eyebrow="NEW QUEST / 新的冒险" title="把想要的成长，写成目标">每条冒险都有独立计划。当前活跃 {active.length} / 3 · 每周合计 {active.reduce((sum, g) => sum + g.weeklyHours, 0)} 小时；新建草稿不占名额。</PageHeading><form className="quest-card creation-form" ref={formRef} onSubmit={submit} noValidate aria-busy={form.pending}>
    <div className="form-intro"><span className="eyebrow">01 / 描绘目的地</span><h2>这次，你想完成什么？</h2></div>
    {([{ key: "title", label: "目标名称", help: "80 字以内。例如：完成我的第一个摄影作品集", placeholder: "一个清晰、具体的成长目标" }, { key: "successCriteria", label: "成功标准", help: "500 字以内。例如：精选并整理 12 张照片，发布一个主题作品集", placeholder: "做到什么，才算抵达终点？" }, { key: "baseline", label: "当前基础", help: "500 字以内。例如：会使用手机拍照，还没有系统学习过构图", placeholder: "你已经掌握什么？从哪里起步？" }] as const).map(field => <div className="field" key={field.key}><label htmlFor={field.key}>{field.label} <span>（必填）</span></label>{field.key === "title" ? <input id={field.key} value={values[field.key]} onChange={e => { setValues({ ...values, [field.key]: e.target.value }); form.clearError(field.key); }} placeholder={field.placeholder} required aria-invalid={!!form.errors[field.key]} aria-describedby={`${field.key}-help ${field.key}-error`} /> : <textarea id={field.key} rows={3} value={values[field.key]} onChange={e => { setValues({ ...values, [field.key]: e.target.value }); form.clearError(field.key); }} placeholder={field.placeholder} required aria-invalid={!!form.errors[field.key]} aria-describedby={`${field.key}-help ${field.key}-error`} />}<small id={`${field.key}-help`}>{field.help}</small><FieldError name={field.key} errors={form.errors} /></div>)}
    <div className="form-intro"><span className="eyebrow">02 / 选择成长的方向</span><h2>让目标与你的成长相连</h2><p>方向由你选择，节奏由你决定。</p></div>
    <fieldset tabIndex={-1} aria-invalid={!!form.errors.direction} aria-describedby="direction-error"><legend>主要成长方向 <span>（必选）</span></legend><p className="field-hint">这个目标主要塑造哪项能力？由你决定，之后的真实任务成长将与此关联。</p><div className="direction-options">{DIRECTIONS.map(direction => <label className="choice direction-choice" key={direction.id}><input type="radio" name="direction" value={direction.id} checked={values.direction === direction.id} onChange={() => { setValues({ ...values, direction: direction.id }); form.clearError("direction"); }} required aria-describedby="direction-error" /><span><strong>{direction.name} <small>{direction.english}</small></strong><small>{direction.description}</small></span></label>)}</div><FieldError name="direction" errors={form.errors} /></fieldset>
    <div className="field"><label htmlFor="weeklyHours">每周投入时间 <span>（必填，小时）</span></label><input id="weeklyHours" type="number" min="1" max="40" step="any" inputMode="decimal" value={values.weeklyHours} onChange={e => { setValues({ ...values, weeklyHours: e.target.value }); form.clearError("weeklyHours"); }} required placeholder="例如：3.5" aria-invalid={!!form.errors.weeklyHours} aria-describedby="weeklyHours-help weeklyHours-error" /><small id="weeklyHours-help">1～40 小时，可以填写小数。选择你能够持续投入的节奏。</small><FieldError name="weeklyHours" errors={form.errors} /></div>
    <p className="local-notice">保存后进入空计划草稿。创建目标不会发放 XP，也不会自动开始执行。</p>{form.message && <p role="alert" className="field-error">{form.message}</p>}<Button disabled={form.disabled} type="submit">{form.pending ? "正在保存目标…" : "创建目标并进入规划"}</Button>
  </form></>;
}
