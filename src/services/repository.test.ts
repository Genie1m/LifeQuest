import { describe, expect, it, vi } from "vitest";
import { emptySnapshot } from "@/domain/types";
import { completedFixture, draftFixture } from "@/test/fixtures";
import { LocalStorageRepository, STORAGE_KEY, type StoragePort } from "./repository";
function storage(raw: string | null = null): StoragePort {
  const values = new Map<string, string>(); if (raw !== null) values.set(STORAGE_KEY, raw);
  return { getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => { values.set(key, value); }) };
}
describe("LocalStorageRepository", () => {
  it("loads an empty store without creating data", async () => {
    const port = storage(); expect(await new LocalStorageRepository(() => port).load()).toBeNull(); expect(port.setItem).not.toHaveBeenCalled();
  });
  it("reads a valid draft with an intentionally unfinished plan", async () => {
    const snapshot = draftFixture(); expect(await new LocalStorageRepository(() => storage(JSON.stringify(snapshot))).load()).toEqual(snapshot);
  });
  it("accepts valid completion references without executing any reward command", async () => {
    const snapshot = completedFixture(); expect(await new LocalStorageRepository(() => storage(JSON.stringify(snapshot))).load()).toEqual(snapshot);
  });
  it.each([
    ["{broken", "invalid-json"],
    [JSON.stringify({ ...emptySnapshot(), schemaVersion: 99 }), "unsupported-version"],
    [JSON.stringify({ ...emptySnapshot(), goals: {} }), "invalid-data"],
    [JSON.stringify({ ...emptySnapshot(), revision: -1 }), "invalid-data"],
    [JSON.stringify({ ...emptySnapshot(), character: { name: "孤立角色" } }), "invalid-data"],
  ])("preserves invalid original input: %s", async (raw, code) => {
    const port = storage(raw); const repo = new LocalStorageRepository(() => port);
    await expect(repo.load()).rejects.toMatchObject({ code });
    await expect(repo.save({ ...emptySnapshot(), revision: 1 }, 0)).rejects.toMatchObject({ code });
    expect(port.getItem(STORAGE_KEY)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled();
  });
  it("saves a valid snapshot then reads the same data", async () => {
    const port = storage(); const repo = new LocalStorageRepository(() => port); const next = { ...emptySnapshot(), revision: 1 };
    await repo.save(next, 0); expect(await repo.load()).toEqual(next); expect(port.setItem).toHaveBeenCalledTimes(1);
  });
  it("refuses stale or skipped revisions", async () => {
    const port = storage(JSON.stringify({ ...emptySnapshot(), revision: 2 })); const repo = new LocalStorageRepository(() => port);
    await expect(repo.save({ ...emptySnapshot(), revision: 2 }, 1)).rejects.toMatchObject({ code: "conflict" });
    await expect(repo.save({ ...emptySnapshot(), revision: 4 }, 2)).rejects.toMatchObject({ code: "invalid-data" }); expect(port.setItem).not.toHaveBeenCalled();
  });
  it("reports storage access failures", async () => {
    const repo = new LocalStorageRepository(() => { throw new DOMException("denied", "SecurityError"); });
    await expect(repo.load()).rejects.toMatchObject({ code: "unavailable" });
  });
  it("reports quota failure and retains persisted data", async () => {
    const port = storage(JSON.stringify(emptySnapshot())); port.setItem = vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); });
    await expect(new LocalStorageRepository(() => port).save({ ...emptySnapshot(), revision: 1 }, 0)).rejects.toMatchObject({ code: "write-failed" });
    expect(JSON.parse(port.getItem(STORAGE_KEY)!)).toEqual(emptySnapshot());
  });
  it("rejects duplicate/orphaned completion entries and inconsistent task states", async () => {
    for (const mutate of [
      (data: ReturnType<typeof completedFixture>) => data.completions.push(data.completions[0]),
      (data: ReturnType<typeof completedFixture>) => { data.completions = []; },
      (data: ReturnType<typeof completedFixture>) => { data.completions[0].xp = 999; },
      (data: ReturnType<typeof completedFixture>) => { data.completions[0].stageTitle = "其他阶段"; },
    ]) {
      const data = completedFixture(); mutate(data); const port = storage(JSON.stringify(data));
      await expect(new LocalStorageRepository(() => port).load()).rejects.toMatchObject({ code: "invalid-data" }); expect(port.setItem).not.toHaveBeenCalled();
    }
  });
});
