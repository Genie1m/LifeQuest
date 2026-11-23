import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/state/AppProvider";
import { LocalStorageRepository, RepositoryError, STORAGE_KEY, type Repository } from "@/services/repository";
import { draftFixture } from "@/test/fixtures";
import { GoalCreationForm, OnboardingForm } from "./creation-forms";
import { GoalDetail, GoalsPage } from "./quest-pages";
import { SessionGate } from "./session-gate";
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), path: "/", search: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => navigation.path, useSearchParams: () => navigation.search }));
function repository(data: ReturnType<typeof draftFixture> | null = null): Repository { return { load: vi.fn().mockResolvedValue(data), save: vi.fn().mockResolvedValue(undefined) }; }
beforeEach(() => { navigation.replace.mockClear(); navigation.push.mockClear(); navigation.path = "/"; window.localStorage.clear(); });
describe("creation UI and protected routes", () => {
  it("redirects first use but never redirects corrupt storage to onboarding", async () => {
    const view = render(<AppProvider repository={repository()}><SessionGate><p>protected content</p></SessionGate></AppProvider>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/onboarding")); expect(screen.queryByText("protected content")).toBeNull();
    view.unmount(); navigation.replace.mockClear(); const repo = repository(); vi.mocked(repo.load).mockRejectedValue(new RepositoryError("invalid-json", "broken"));
    render(<AppProvider repository={repo}><SessionGate><p>protected content</p></SessionGate></AppProvider>);
    await act(async () => {}); expect(navigation.replace).not.toHaveBeenCalled(); expect(screen.queryByText("protected content")).toBeNull();
  });
  it("redirects an existing character out of onboarding", async () => {
    render(<AppProvider repository={repository(draftFixture())}><SessionGate><OnboardingForm /></SessionGate></AppProvider>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
  });
  it("retains role input and never signals success on failed storage; retries atomically", async () => {
    const repo = repository(); vi.mocked(repo.save).mockRejectedValueOnce(new RepositoryError("write-failed", "quota"));
    render(<AppProvider repository={repo}><SessionGate><OnboardingForm /></SessionGate></AppProvider>); navigation.path = "/onboarding";
    const field = await screen.findByLabelText(/冒险者昵称/); fireEvent.click(screen.getByRole("radio", { name: "知识法师" })); fireEvent.change(field, { target: { value: " 星辰 " } });
    fireEvent.click(screen.getByRole("button", { name: "创建冒险者" }));
    await screen.findByRole("alert"); expect(field).toHaveValue(" 星辰 "); expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "创建冒险者" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/?welcome=1"));
    const saved = vi.mocked(repo.save).mock.calls[1][0]; expect(saved.profile?.id).toBe(saved.character?.profileId); expect(saved.character?.name).toBe("星辰");
  });
  it("shows field validation without blocking later writes as storage corruption", async () => {
    navigation.path = "/onboarding"; const repo = repository();
    render(<AppProvider repository={repo}><SessionGate><OnboardingForm /></SessionGate></AppProvider>);
    const field = await screen.findByLabelText(/冒险者昵称/); fireEvent.click(screen.getByRole("radio", { name: "知识法师" })); fireEvent.click(screen.getByRole("button", { name: "创建冒险者" }));
    await screen.findByText("请填写昵称"); expect(field).toHaveFocus(); expect(repo.save).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "有效昵称" } });
    expect(screen.queryByText("请填写昵称")).toBeNull(); expect(field).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "创建冒险者" }));
    await waitFor(() => expect(repo.save).toHaveBeenCalledTimes(1));
  });
  it("disables duplicate submits while persistence is pending", async () => {
    navigation.path = "/onboarding"; let release!: () => void; const repo = repository();
    vi.mocked(repo.save).mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    render(<AppProvider repository={repo}><SessionGate><OnboardingForm /></SessionGate></AppProvider>);
    fireEvent.change(await screen.findByLabelText(/冒险者昵称/), { target: { value: "星辰" } }); fireEvent.click(screen.getByRole("radio", { name: "知识法师" })); fireEvent.click(screen.getByRole("button", { name: "创建冒险者" }));
    expect(await screen.findByRole("button", { name: "正在保存角色…" })).toBeDisabled(); expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => { release(); }); expect(repo.save).toHaveBeenCalledTimes(1);
  });
  it("retains goal input on failure without partial data and persists a successful retry across reload", async () => {
    const data = draftFixture(); data.goals = []; window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const real = new LocalStorageRepository(); let fail = true;
    const repo: Repository = { load: () => real.load(), save: async (next, revision) => { if (fail) throw new RepositoryError("write-failed", "quota"); await real.save(next, revision); } };
    render(<AppProvider repository={repo}><SessionGate><GoalCreationForm /></SessionGate></AppProvider>);
    fireEvent.change(await screen.findByLabelText(/目标名称/), { target: { value: "完成摄影集" } });
    expect(screen.getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    fireEvent.change(screen.getByLabelText(/成功标准/), { target: { value: "十二张精选作品" } });
    fireEvent.change(screen.getByLabelText(/当前基础/), { target: { value: "会手机摄影" } });
    fireEvent.click(screen.getByRole("radio", { name: /创造/ })); fireEvent.change(screen.getByLabelText(/每周投入时间/), { target: { value: "3.5" } });
    fireEvent.click(screen.getByRole("button", { name: "创建目标并进入规划" })); await screen.findByRole("alert");
    expect(navigation.push).not.toHaveBeenCalled(); expect((await real.load())?.goals).toEqual([]); expect(screen.getByLabelText(/目标名称/)).toHaveValue("完成摄影集");
    fail = false; fireEvent.click(screen.getByRole("button", { name: "创建目标并进入规划" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    const reload = await new LocalStorageRepository().load(); expect(reload?.character).toEqual(data.character); expect(reload?.goals[0]).toMatchObject({ status: "draft", draft: { content: { stages: [] } } }); expect(reload?.revision).toBe(data.revision + 1);
  });
  it("reads actual goals and handles unknown IDs without altering storage", async () => {
    const repo = repository(draftFixture()); render(<AppProvider repository={repo}><SessionGate><GoalsPage /><GoalDetail id="unknown" /></SessionGate></AppProvider>);
    expect(await screen.findByText("测试目标")).toBeInTheDocument(); expect(screen.getByText("未找到这个目标")).toBeInTheDocument(); expect(repo.save).not.toHaveBeenCalled();
  });
});
