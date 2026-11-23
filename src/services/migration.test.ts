import { describe, expect, it, vi } from "vitest";
import { migrateV1 } from "@/domain/migration";
import { parseSnapshotV1 } from "@/domain/legacy/validation-v1";
import { emptySnapshot as emptyV1 } from "@/domain/legacy/types-v1";
import { characterGrowth } from "@/domain/progression";
import { v1Completed, v1Draft, activeFixture } from "@/test/multi-fixtures";
import { stamp } from "@/test/fixtures";
import { LocalStorageRepository, STORAGE_KEY, type StoragePort } from "./repository";
function storage(raw: string) {
  const values = new Map<string, string>([[STORAGE_KEY, raw]]);
  const port: StoragePort = { getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => { values.set(key, value); }) };
  return { port, values, repo: new LocalStorageRepository(() => port) };
}
describe("frozen v1 decoder and pure v2 transformation", () => {
  it("upgrades an empty old archive without inventing identity", () => {
    expect(migrateV1(emptyV1())).toEqual({ ...emptyV1(), schemaVersion: 2, revision: 1 });
  });
  it.each([["mage", "scholar-mage"], ["ranger", "pathfinder"], ["artisan", "artificer"], ["knight", undefined], ["adventurer", undefined], ["compass", undefined], ["unknown-valid", undefined]])("maps %s without replacing historical identity", (avatarId, classId) => {
    const old = v1Completed(); old.character!.avatarId = avatarId!;
    const before = structuredClone(old); const next = migrateV1(old);
    expect(old).toEqual(before); expect(next.character).toEqual({ ...old.character, ...(classId ? { classId, appearanceId: `${classId}-a-v1` } : {}) });
    expect(next.goals).toEqual(old.goals); expect(next.completions).toEqual(old.completions);
    expect(next.profile).toEqual(old.profile); expect(next.revision).toBe(old.revision + 1);
    expect(characterGrowth(old.character!.id, old.completions)).toEqual(characterGrowth(next.character!.id, next.completions));
    expect(migrateV1(old)).toEqual(next);
  });
  it("preserves active execution and revision drafts and focuses only the active goal", () => {
    const active = { ...activeFixture(1), schemaVersion: 1 as const };
    active.goals[0].draft = { baseRevision: 1, source: "manual", updatedAt: stamp, content: structuredClone(active.goals[0].confirmedPlan!.content) };
    const result = migrateV1(active); expect(result.goals).toEqual(active.goals); expect(result.focusGoalId).toBe(active.goals[0].id);
    const draft = v1Draft(); expect(migrateV1(draft).goals).toEqual(draft.goals); expect(migrateV1(draft).focusGoalId).toBeUndefined();
  });
  it("retains the original single-unfinished v1 rule and rejects bad references", () => {
    const invalid = { ...activeFixture(2), schemaVersion: 1 }; expect(() => parseSnapshotV1(invalid)).toThrow("one-unfinished"); expect(() => migrateV1(invalid)).toThrow();
    const bad = v1Completed(); bad.completions[0].xp = 999; expect(() => migrateV1(bad)).toThrow();
  });
});
describe("explicit backup-first migration", () => {
  it("does not write during loading; upgrades once and reuses the exact raw backup", async () => {
    const old = v1Completed(); const raw = JSON.stringify(old, null, 2); const { repo, port, values } = storage(raw);
    await expect(repo.load()).rejects.toMatchObject({ code: "migration-required", raw }); expect(port.setItem).not.toHaveBeenCalled();
    const result = await repo.migrate(raw); expect(result).toEqual(migrateV1(old));
    expect(values.get(`lifequest:backup:v1:r${old.revision}`)).toBe(raw);
    expect(vi.mocked(port.setItem).mock.calls.map(c => c[0])).toEqual([`lifequest:backup:v1:r${old.revision}`, STORAGE_KEY]);
    expect(await repo.migrate(raw)).toEqual(result); expect(port.setItem).toHaveBeenCalledTimes(2);
    expect(await repo.load()).toEqual(result);
  });
  it.each(["{broken", JSON.stringify({ ...emptyV1(), schemaVersion: 99 }), JSON.stringify({ ...emptyV1(), revision: -1 }), JSON.stringify({ ...v1Completed(), completions: [] })])("does not touch invalid input: %s", async raw => {
    const { repo, values, port } = storage(raw); await expect(repo.load()).rejects.toThrow(); await expect(repo.migrate(raw)).rejects.toThrow(); expect(values.get(STORAGE_KEY)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled();
  });
  it("leaves the primary untouched if backup fails and allows safe retry", async () => {
    const raw = JSON.stringify(v1Draft()); const { repo, values, port } = storage(raw); const write = port.setItem;
    port.setItem = vi.fn(() => { throw new Error("quota"); }); await expect(repo.migrate(raw)).rejects.toMatchObject({ code: "backup-failed" }); expect(values.get(STORAGE_KEY)).toBe(raw);
    port.setItem = write; expect((await repo.migrate(raw)).schemaVersion).toBe(2);
  });
  it("retains v1 and its backup if the primary write fails, then reuses backup", async () => {
    const old = v1Draft(); const raw = JSON.stringify(old); const { repo, port, values } = storage(raw); const write = port.setItem;
    port.setItem = vi.fn((key, value) => { if (key === STORAGE_KEY) throw new Error("quota"); write(key, value); });
    await expect(repo.migrate(raw)).rejects.toMatchObject({ code: "write-failed" }); expect(values.get(STORAGE_KEY)).toBe(raw); expect(values.get(`lifequest:backup:v1:r${old.revision}`)).toBe(raw);
    vi.mocked(write).mockClear(); port.setItem = write; await repo.migrate(raw); expect(port.setItem).toHaveBeenCalledTimes(1);
  });
  it("refuses a conflicting backup without overwriting either key", async () => {
    const old = v1Draft(); const raw = JSON.stringify(old); const { repo, port, values } = storage(raw); values.set(`lifequest:backup:v1:r${old.revision}`, "different");
    await expect(repo.migrate(raw)).rejects.toMatchObject({ code: "conflict" }); expect(values.get(STORAGE_KEY)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled();
  });
  it("detects external changes during backup and cancellation before commit", async () => {
    const raw = JSON.stringify(v1Draft()); const { repo, port, values } = storage(raw); const write = port.setItem;
    port.setItem = (key, value) => { write(key, value); if (key.startsWith("lifequest:backup")) values.set(STORAGE_KEY, "external"); };
    await expect(repo.migrate(raw)).rejects.toMatchObject({ code: "conflict" }); expect(values.get(STORAGE_KEY)).toBe("external");
    const another = storage(raw); await expect(another.repo.migrate(raw, () => false)).rejects.toMatchObject({ code: "conflict" }); expect(another.values.get(STORAGE_KEY)).toBe(raw);
  });
  it("never rolls back a successful write when post-write reading fails", async () => {
    const raw = JSON.stringify(v1Completed()); const { repo, port, values } = storage(raw); const read = port.getItem; let wrote = false; const write = port.setItem;
    port.setItem = (key, value) => { write(key, value); if (key === STORAGE_KEY) wrote = true; };
    port.getItem = key => { if (wrote && key === STORAGE_KEY) throw new Error("denied"); return read(key); };
    await expect(repo.migrate(raw)).rejects.toMatchObject({ code: "verification-failed" });
    expect(JSON.parse(values.get(STORAGE_KEY)!).schemaVersion).toBe(2); expect(write).toHaveBeenCalledTimes(2);
    port.getItem = read; expect((await repo.load())?.schemaVersion).toBe(2);
  });
  it("does not overwrite v2 changes when an old upgrade request is replayed", async () => {
    const raw = JSON.stringify(v1Draft()); const { repo, values } = storage(raw); const next = await repo.migrate(raw);
    const changed = { ...next, revision: next.revision + 1 }; values.set(STORAGE_KEY, JSON.stringify(changed));
    await expect(repo.migrate(raw)).rejects.toMatchObject({ code: "conflict" }); expect(await repo.load()).toEqual(changed);
  });
});
