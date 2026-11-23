import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProvider, useAppState } from "./AppProvider";
import { LocalStorageRepository, STORAGE_KEY, type StoragePort } from "@/services/repository";
import { v1Draft } from "@/test/multi-fixtures";
import { SessionGate } from "@/components/session-gate";
import { StorageFeedback } from "@/components/feedback";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/" }));
let state: ReturnType<typeof useAppState>;
function Probe() { const value = useAppState(); useLayoutEffect(() => { state = value; }, [value]); return <span>{value.status}</span>; }
function setup() {
  const raw = JSON.stringify(v1Draft()); const values = new Map([[STORAGE_KEY, raw]]);
  const port: StoragePort = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  return { raw, values, port, repo: new LocalStorageRepository(() => port) };
}
describe("migration provider boundary", () => {
  it("blocks business UI and ordinary saves until explicit upgrade succeeds", async () => {
    const { repo, values, raw } = setup();
    render(<AppProvider repository={repo}><Probe /><StorageFeedback /><SessionGate><p>business UI</p></SessionGate></AppProvider>);
    await screen.findByText("migration-required"); expect(screen.queryByText("business UI")).toBeNull(); expect(state.snapshot).toBeNull(); expect(values.get(STORAGE_KEY)).toBe(raw);
    await act(async () => { expect(await state.save(s => s)).toBe(false); });
    fireEvent.click(screen.getByRole("button", { name: "升级本机冒险档案" }));
    await screen.findByText("business UI"); await waitFor(() => expect(state.snapshot?.schemaVersion).toBe(2)); expect(state.snapshot?.goals).toHaveLength(1);
    expect(await state.readRaw()).toBe(values.get(STORAGE_KEY));
  });
  it("keeps the candidate unpublished when backup fails and supports explicit retry", async () => {
    const { repo, port, values, raw } = setup(); const write = port.setItem;
    port.setItem = () => { throw new Error("quota"); };
    render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("migration-required");
    await act(async () => { expect(await state.upgrade()).toBe(false); });
    expect(state.snapshot).toBeNull(); expect(state.blocked).toBe(false); expect(state.error?.code).toBe("backup-failed"); expect(values.get(STORAGE_KEY)).toBe(raw);
    port.setItem = write; await act(async () => { expect(await state.upgrade()).toBe(true); }); expect(state.status).toBe("ready");
  });
  it("freezes after post-write verification failure and reloads actual v2 without rollback", async () => {
    const { repo, port, values } = setup(); const read = port.getItem; const write = port.setItem; let wrote = false;
    port.setItem = (key, value) => { write(key, value); if (key === STORAGE_KEY) wrote = true; };
    port.getItem = key => { if (wrote && key === STORAGE_KEY) throw new Error("read failure"); return read(key); };
    render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("migration-required");
    await act(async () => { expect(await state.upgrade()).toBe(false); });
    expect(state.snapshot).toBeNull(); expect(state.blocked).toBe(true); expect(state.error?.code).toBe("verification-failed"); expect(JSON.parse(values.get(STORAGE_KEY)!).schemaVersion).toBe(2);
    port.getItem = read; await act(async () => { await state.reload(); }); expect(state.status).toBe("ready"); expect(state.snapshot?.revision).toBe(v1Draft().revision + 1);
  });
  it("ignores backup storage events but freezes upgrade when the primary changes", async () => {
    const { repo, values, raw } = setup(); render(<AppProvider repository={repo}><Probe /></AppProvider>); await screen.findByText("migration-required");
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "lifequest:backup:v1:r3" }))); expect(state.blocked).toBe(false);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY })));
    await act(async () => { expect(await state.upgrade()).toBe(false); }); expect(state.blocked).toBe(true); expect(values.get(STORAGE_KEY)).toBe(raw);
    await act(async () => { await state.reload(); }); await waitFor(() => expect(state.blocked).toBe(false));
  });
});
