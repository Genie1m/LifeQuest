import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ClassSelection } from "./class-selection";
import { CharacterArtwork } from "./artwork";
import { CharacterPanel } from "./character-panel";
import { AppProvider } from "@/state/AppProvider";
import { completedFixture } from "@/test/fixtures";
import { characterVocation } from "@/domain/catalog";
import { LocalStorageRepository, STORAGE_KEY } from "@/services/repository";

function Selector() {
  const [value, setValue] = useState("");
  return <ClassSelection value={value} onChange={setValue} />;
}
describe("v1 character visual bridge", () => {
  it("previews without auto-selecting and synchronizes vocation copy and art", () => {
    render(<Selector />);
    expect(screen.getAllByRole("radio").every(input => !(input as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByAltText("知识法师基础人物立绘")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "探索游侠" }));
    expect(screen.getByAltText("探索游侠基础人物立绘")).toBeInTheDocument();
    expect(screen.queryByAltText("知识法师基础人物立绘")).toBeNull();
    expect(screen.getByText("探索地图 · 指南针 · 远行背包")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "探索游侠" })).toBeChecked();
  });
  it("shows an actionable image error and retries without an icon substitute", async () => {
    const view = render(<CharacterArtwork avatarId="mage" eager />);
    fireEvent.error(screen.getByAltText("知识法师基础人物立绘"));
    expect(screen.getByText("知识法师插画暂时无法加载")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试图片" }));
    const image = screen.getByAltText("知识法师基础人物立绘");
    expect(image).toHaveAttribute("src", expect.stringContaining("retry=1"));
    fireEvent.load(image); await waitFor(() => expect(screen.queryByText("正在载入人物…")).toBeNull());
    view.rerender(<CharacterArtwork avatarId="artisan" />);
    expect(screen.getByAltText("创造工匠基础人物立绘")).toBeInTheDocument();
  });
  it.each(["mage", "ranger", "artisan"])("renders mapped %s without writing its completed history", async id => {
    const data = completedFixture(); data.character!.avatarId = id;
    const raw = JSON.stringify(data); window.localStorage.setItem(STORAGE_KEY, raw);
    const repo = new LocalStorageRepository(); const save = vi.spyOn(repo, "save");
    render(<AppProvider repository={repo}><CharacterPanel full /></AppProvider>);
    await screen.findByAltText(`${characterVocation(id)!.name}基础人物立绘`);
    expect(screen.getByText("XP").parentElement).toHaveTextContent("40 XP");
    expect(screen.getByRole("progressbar", { name: "当前等级经验进度" })).toHaveAttribute("value", "40");
    expect(screen.getByText(/尚未制作或解锁/)).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw); expect(save).not.toHaveBeenCalled();
  });
  it.each(["knight", "adventurer", "compass", "retained-legacy"])("does not assign a vocation to legacy %s", async id => {
    const data = completedFixture(); data.character!.avatarId = id;
    const raw = JSON.stringify(data); window.localStorage.setItem(STORAGE_KEY, raw);
    const repo = new LocalStorageRepository(); const save = vi.spyOn(repo, "save");
    render(<AppProvider repository={repo}><CharacterPanel full /></AppProvider>);
    await screen.findByText("旧版形象 · 职业尚未确认");
    expect(characterVocation(id)).toBeUndefined();
    expect(screen.queryByRole("img", { name: /基础人物立绘/ })).toBeNull();
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw));
    expect(save).not.toHaveBeenCalled();
  });
});
