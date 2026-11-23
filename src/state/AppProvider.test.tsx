import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProvider, useAppState } from "./AppProvider";
import { emptySnapshot } from "@/domain/types";
import { draftFixture } from "@/test/fixtures";
import { RepositoryError, STORAGE_KEY, type Repository } from "@/services/repository";
let context: ReturnType<typeof useAppState>;
function Probe() {
  const state = useAppState();
  useLayoutEffect(() => { context = state; }, [state]);
  return <div><span>{state.status}</span><span>revision:{state.snapshot?.revision ?? "none"}</span>{state.error && <p role="alert">{state.error.code}</p>}</div>;
}
function repository(): Repository { return { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(undefined) }; }
describe("AppProvider", () => {
  it("renders an SSR loading state without reading browser storage", () => {
    const repo = repository(); const html = renderToString(<AppProvider repository={repo}><Probe /></AppProvider>);
    expect(html).toContain("loading"); expect(repo.load).not.toHaveBeenCalled();
  });
  it("initializes an empty ready snapshot without automatically saving", async () => {
    const repo = repository(); render(<AppProvider repository={repo}><Probe /></AppProvider>);
    expect(screen.getByText("loading")).toBeInTheDocument(); await screen.findByText("ready");
    await waitFor(() => expect(context.snapshot).toEqual(emptySnapshot())); expect(repo.save).not.toHaveBeenCalled();
  });
  it("initializes an existing valid snapshot", async () => {
    const repo = repository(); vi.mocked(repo.load).mockResolvedValue(draftFixture());
    render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("ready"); expect(context.snapshot).toEqual(draftFixture());
  });
  it("does not initialize defaults or allow saving after read failure", async () => {
    const repo = repository(); vi.mocked(repo.load).mockRejectedValue(new RepositoryError("invalid-json", "broken"));
    render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("error");
    expect(context.snapshot).toBeNull(); await act(async () => { expect(await context.save(s => s)).toBe(false); }); expect(repo.save).not.toHaveBeenCalled();
  });
  it("commits state only after successful storage and serializes queued saves", async () => {
    const repo = repository(); render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("ready");
    await act(async () => { await Promise.all([context.save(s => s), context.save(s => s)]); });
    expect(context.snapshot?.revision).toBe(2); expect(vi.mocked(repo.save).mock.calls.map(call => call[1])).toEqual([0, 1]);
  });
  it("retains the last saved state on write failure and permits retry", async () => {
    const repo = repository(); vi.mocked(repo.save).mockRejectedValueOnce(new RepositoryError("write-failed", "quota"));
    render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("ready");
    await act(async () => { expect(await context.save(s => s)).toBe(false); });
    expect(context.snapshot?.revision).toBe(0); expect(context.error?.code).toBe("write-failed"); expect(context.blocked).toBe(false);
    await act(async () => { expect(await context.save(s => s)).toBe(true); }); expect(context.snapshot?.revision).toBe(1);
  });
  it("freezes stale writes on external changes and reloads explicitly", async () => {
    const repo = repository(); render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("ready");
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "changed" })));
    expect(context.blocked).toBe(true); await act(async () => { expect(await context.save(s => s)).toBe(false); }); expect(repo.save).not.toHaveBeenCalled();
    await act(async () => { await context.reload(); }); await waitFor(() => expect(context.blocked).toBe(false));
  });
  it("blocks after repository revision conflict", async () => {
    const repo = repository(); vi.mocked(repo.save).mockRejectedValue(new RepositoryError("conflict", "stale"));
    render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("ready");
    await act(async () => { await context.save(s => s); }); expect(context.blocked).toBe(true); expect(context.snapshot?.revision).toBe(0);
  });
});
