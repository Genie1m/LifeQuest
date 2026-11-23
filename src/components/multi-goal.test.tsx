import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppProvider } from "@/state/AppProvider";
import { LocalStorageRepository, RepositoryError, STORAGE_KEY, type Repository } from "@/services/repository";
import { draftFixture, completedFixture } from "@/test/fixtures";
import { activeFixture, readyDraft } from "@/test/multi-fixtures";
import { AdventureHall, GoalsPage } from "./quest-pages";
import { GoalCreationForm } from "./creation-forms";
import { CharacterPanel } from "./character/character-panel";
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams() }));
function repository(data = draftFixture()): Repository { return { load: vi.fn().mockResolvedValue(data), save: vi.fn().mockResolvedValue(undefined) }; }
describe("quest journal and hall", () => {
  it("lets an existing adventurer create another goal and renders independent links", async () => {
    const data = draftFixture(); data.goals.push(readyDraft(2)); const repo = repository(data);
    render(<AppProvider repository={repo}><GoalsPage /><GoalCreationForm /></AppProvider>);
    await screen.findByRole("heading", { name: "我的成长冒险" }); expect(screen.getByLabelText(/目标名称/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "测试目标" })).toBeInTheDocument(); expect(screen.getByRole("heading", { name: "冒险 2" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "继续规划冒险" }).map(a => a.getAttribute("href"))).toEqual(data.goals.map(g => `/goals/${g.id}/plan`)); expect(screen.getByRole("link", { name: "创建新冒险" })).toHaveAttribute("href", "/goals/new"); expect(repo.save).not.toHaveBeenCalled();
  });
  it("shows drafts accurately without fabricated tasks or progress", async () => {
    render(<AppProvider repository={repository()}><AdventureHall /></AppProvider>); await screen.findByText("你的冒险正在规划中。");
    expect(screen.queryByText(/CURRENT FOCUS/)).toBeNull(); expect(screen.queryByText(/下一步 ·/)).toBeNull(); expect(screen.getByText("尚未制定章节计划")).toBeInTheDocument();
  });
  it("shows only the focused real next task and clears focus on pause", async () => {
    const data = activeFixture(2); data.focusGoalId = data.goals[0].id; const repo = repository(data);
    render(<AppProvider repository={repo}><AdventureHall /></AppProvider>); await screen.findByText("下一步 · 任务 1"); expect(screen.queryByText("下一步 · 任务 2")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "暂停冒险" })[0]); await screen.findByText("选择你当前的重点主线");
    const saved = vi.mocked(repo.save).mock.calls[0][0]; expect(saved.focusGoalId).toBeUndefined(); expect(saved.goals[0].confirmedPlan).toEqual(data.goals[0].confirmedPlan);
  });
  it("explains fourth resume rejection without saving or changing plans", async () => {
    const data = activeFixture(4); data.goals[3].status = "paused"; const repo = repository(data);
    render(<AppProvider repository={repo}><GoalsPage /></AppProvider>); fireEvent.click(await screen.findByRole("button", { name: "恢复冒险" }));
    await screen.findByText(/已有 3 条活跃冒险/); expect(repo.save).not.toHaveBeenCalled();
  });
  it("keeps focus unchanged and reports failure when a state action cannot save", async () => {
    const data = activeFixture(1); const repo = repository(data); vi.mocked(repo.save).mockRejectedValue(new RepositoryError("write-failed", "quota"));
    render(<AppProvider repository={repo}><AdventureHall /></AppProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "设为重点" }));
    await screen.findByText(/尚未保存，状态保持不变/); expect(screen.getByText("选择你当前的重点主线")).toBeInTheDocument(); expect(screen.queryByText(/CURRENT FOCUS/)).toBeNull();
  });
  it("resumes with its saved revision draft and navigates to that goal plan", async () => {
    navigation.push.mockClear(); const data = activeFixture(1); const goal = data.goals[0]; goal.status = "paused";
    goal.draft = { baseRevision: 1, source: "manual", updatedAt: goal.createdAt, content: structuredClone(goal.confirmedPlan!.content) }; const repo = repository(data);
    render(<AppProvider repository={repo}><GoalsPage /></AppProvider>); fireEvent.click(await screen.findByRole("button", { name: "恢复冒险" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/goals/${goal.id}/plan`));
    expect(vi.mocked(repo.save).mock.calls[0][0].goals[0]).toEqual({ ...goal, status: "active" });
  });
  it("guards duplicate goal submissions while a write is pending", async () => {
    navigation.push.mockClear(); const repo = repository(); let release!: () => void;
    vi.mocked(repo.save).mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    render(<AppProvider repository={repo}><GoalCreationForm /></AppProvider>);
    fireEvent.change(await screen.findByLabelText(/目标名称/), { target: { value: "第二个目标" } }); fireEvent.change(screen.getByLabelText(/成功标准/), { target: { value: "作品" } }); fireEvent.change(screen.getByLabelText(/当前基础/), { target: { value: "初学" } }); fireEvent.change(screen.getByLabelText(/每周投入时间/), { target: { value: "3" } }); fireEvent.click(screen.getByRole("radio", { name: /创造/ }));
    const button = screen.getByRole("button", { name: "创建目标并进入规划" }); fireEvent.click(button); fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "正在保存目标…" })).toBeDisabled(); expect(repo.save).toHaveBeenCalledTimes(1);
    await act(async () => { release(); }); expect(navigation.push).toHaveBeenCalledTimes(1); expect(vi.mocked(repo.save).mock.calls[0][0].goals).toHaveLength(2);
  });
  it("leaves existing adventures and form input intact when creating a second goal fails", async () => {
    const data = draftFixture(); const raw = JSON.stringify(data); window.localStorage.setItem(STORAGE_KEY, raw);
    const real = new LocalStorageRepository(); const repo: Repository = { load: () => real.load(), save: vi.fn().mockRejectedValue(new RepositoryError("write-failed", "quota")) };
    render(<AppProvider repository={repo}><GoalCreationForm /></AppProvider>);
    fireEvent.change(await screen.findByLabelText(/目标名称/), { target: { value: "第二条目标" } }); fireEvent.change(screen.getByLabelText(/成功标准/), { target: { value: "作品" } }); fireEvent.change(screen.getByLabelText(/当前基础/), { target: { value: "初学" } }); fireEvent.change(screen.getByLabelText(/每周投入时间/), { target: { value: "3" } }); fireEvent.click(screen.getByRole("radio", { name: /创造/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建目标并进入规划" })); await screen.findByRole("alert"); expect(screen.getByLabelText(/目标名称/)).toHaveValue("第二条目标"); expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("shows paused-only and completed-only halls with truthful entries", async () => {
    const paused = activeFixture(1); paused.goals[0].status = "paused";
    const view = render(<AppProvider repository={repository(paused)}><AdventureHall /></AppProvider>); await screen.findByText("你的冒险暂时休整中"); expect(screen.getByRole("button", { name: "恢复冒险" })).toBeInTheDocument(); view.unmount();
    render(<AppProvider repository={repository(completedFixture())}><AdventureHall /></AppProvider>); await screen.findByText("走过的旅程，已收入档案"); expect(screen.queryByRole("button", { name: "恢复冒险" })).toBeNull();
  });
  it("explicitly confirms legacy class, keeps history, and renders chosen artwork after refresh", async () => {
    const old = completedFixture(); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(old)); const repo = new LocalStorageRepository();
    const view = render(<AppProvider repository={repo}><CharacterPanel full /></AppProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "选择并确认职业" })); fireEvent.click(screen.getByRole("radio", { name: "探索游侠" })); fireEvent.click(screen.getByRole("button", { name: "确认职业并保留原档案" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "确认职业并保留原档案" })).toBeNull());
    const next = await repo.load(); expect(next?.character).toEqual({ ...old.character, classId: "pathfinder", appearanceId: "pathfinder-a-v1" }); expect(next?.goals).toEqual(old.goals); expect(next?.completions).toEqual(old.completions);
    view.unmount(); render(<AppProvider repository={repo}><CharacterPanel /></AppProvider>); expect(await screen.findByAltText("探索游侠头肩头像")).toBeInTheDocument(); await act(async () => {});
  });
});
