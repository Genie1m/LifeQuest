"use client";
import { useRef, useState, type FormEvent } from "react";
import { confirmCharacterClass } from "@/domain/commands";
import { useCommandForm } from "../creation-forms";
import { ClassSelection } from "./class-selection";
import { Button } from "../ui/button";

export function ProfessionConfirmation() {
  const [open, setOpen] = useState(false); const [value, setValue] = useState("");
  const ref = useRef<HTMLFormElement>(null); const form = useCommandForm(ref);
  async function submit(e: FormEvent) { e.preventDefault(); await form.submit(s => confirmCharacterClass(s, value)); }
  return <section className="quest-section"><h3>为原来的冒险者，确认新的职业</h3><p>保留昵称、原头像标识、全部目标与经验，不会新建角色。确认后当前版本不支持转职。</p>{!open ? <Button variant="outline" onClick={() => setOpen(true)}>选择并确认职业</Button> : <form ref={ref} onSubmit={submit} noValidate><ClassSelection value={value} onChange={setValue} /><Button type="submit" disabled={form.disabled || !value}>{form.pending ? "正在保存…" : "确认职业并保留原档案"}</Button>{form.message && <p className="field-error" role="alert">{form.message}</p>}</form>}</section>;
}
