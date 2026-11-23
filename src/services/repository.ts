import type { AppSnapshot } from "@/domain/types";
import { parseSnapshot, SnapshotValidationError } from "@/domain/validation";
import { parseSnapshotV1 } from "@/domain/legacy/validation-v1";
import { migrateV1 } from "@/domain/migration";

export const STORAGE_KEY = "lifequest:state";
export type StorageErrorCode = "invalid-json" | "invalid-data" | "unsupported-version" | "unavailable" | "write-failed" | "conflict" | "migration-required" | "backup-failed" | "verification-failed";
export class RepositoryError extends Error {
  constructor(public readonly code: StorageErrorCode, message: string) { super(message); this.name = "RepositoryError"; }
}
export class MigrationRequiredError extends RepositoryError {
  constructor(public readonly raw: string) { super("migration-required", "此浏览器保存着旧版冒险档案，请明确升级后继续。"); }
}
export interface Repository {
  load(): Promise<AppSnapshot | null>;
  save(next: AppSnapshot, expectedRevision: number): Promise<void>;
  migrate?(expectedRaw: string, canCommit?: () => boolean): Promise<AppSnapshot>;
  readRaw?(): Promise<string | null>;
}
export type StoragePort = Pick<Storage, "getItem" | "setItem">;
function decode(raw: string): unknown {
  try { return JSON.parse(raw); }
  catch { throw new RepositoryError("invalid-json", "本地数据无法解析；原始数据已保留，请勿清除站点数据。"); }
}
function oldSnapshot(value: unknown) {
  try { return parseSnapshotV1(value); }
  catch { throw new RepositoryError("invalid-data", "旧档案未通过原版 v1 校验，原始数据已保留。"); }
}
export class LocalStorageRepository implements Repository {
  constructor(private readonly getStorage: () => StoragePort = () => window.localStorage) {}
  async readRaw(): Promise<string | null> { return this.read(STORAGE_KEY); }
  private read(key: string) {
    try { return this.getStorage().getItem(key); }
    catch { throw new RepositoryError("unavailable", "无法读取本地存储。请检查浏览器设置后重试。"); }
  }
  async load(): Promise<AppSnapshot | null> {
    const raw = this.read(STORAGE_KEY);
    if (raw === null) return null;
    const value = decode(raw);
    if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 1) {
      oldSnapshot(value);
      throw new MigrationRequiredError(raw);
    }
    return this.validate(value);
  }
  private validate(value: unknown) {
    try { return parseSnapshot(value); }
    catch (error) {
      if (error instanceof SnapshotValidationError) throw new RepositoryError(error.code, error.message);
      throw new RepositoryError("invalid-data", "本地数据结构无效；原始数据已保留。");
    }
  }
  async migrate(expectedRaw: string, canCommit: () => boolean = () => true): Promise<AppSnapshot> {
    const currentRaw = this.read(STORAGE_KEY);
    if (currentRaw !== expectedRaw) {
      if (currentRaw !== null) {
        const value = decode(currentRaw);
        if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 2) {
          const actual = this.validate(value);
          const expected = migrateV1(oldSnapshot(decode(expectedRaw)));
          if (canCommit() && JSON.stringify(actual) === JSON.stringify(expected)) return actual;
        }
      }
      throw new RepositoryError("conflict", "原始档案已变化，请重新读取后决定下一步。尚未覆盖主档案。");
    }
    const old = oldSnapshot(decode(expectedRaw));
    const next = migrateV1(old);
    const backupKey = `lifequest:backup:v1:r${old.revision}`;
    const backup = this.read(backupKey);
    if (backup !== null && backup !== expectedRaw) throw new RepositoryError("conflict", "同版本备份已有不同内容，已停止升级，未覆盖备份或主档案。");
    if (backup === null) {
      try { this.getStorage().setItem(backupKey, expectedRaw); }
      catch { throw new RepositoryError("backup-failed", "旧档案备份失败，主档案未修改。请保全原文并检查存储空间后重试。"); }
    }
    if (this.read(backupKey) !== expectedRaw) throw new RepositoryError("backup-failed", "备份读回不一致，主档案未修改。");
    if (!canCommit() || this.read(STORAGE_KEY) !== expectedRaw) throw new RepositoryError("conflict", "升级前检测到档案变化，已停止写入。请关闭其他标签页并重新读取。");
    const serialized = JSON.stringify(next);
    try { this.getStorage().setItem(STORAGE_KEY, serialized); }
    catch { throw new RepositoryError("write-failed", "升级主档案写入失败，旧档案及备份仍保留；可重新读取后重试。"); }
    try {
      const actualRaw = this.read(STORAGE_KEY);
      if (actualRaw !== serialized) throw new Error("changed");
      return this.validate(decode(actualRaw));
    } catch {
      throw new RepositoryError("verification-failed", "升级写入后未能确认读回结果，档案可能已经是 v2。编辑已停止；请重新读取实际版本，不要回滚或清空。旧版备份仍保留。");
    }
  }
  async save(next: AppSnapshot, expectedRevision: number): Promise<void> {
    this.validate(next);
    const current = await this.load();
    if ((current?.revision ?? 0) !== expectedRevision) throw new RepositoryError("conflict", "其他页面已修改数据，请重新读取后再操作。");
    if (next.revision !== expectedRevision + 1) throw new RepositoryError("invalid-data", "保存版本必须逐次递增。");
    try { this.getStorage().setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new RepositoryError("write-failed", "保存失败，可能空间不足或存储被禁用。当前修改尚未保存，可重试。"); }
  }
}
