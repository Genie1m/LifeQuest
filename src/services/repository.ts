import type { AppSnapshot } from "@/domain/types";
import { parseSnapshot, SnapshotValidationError } from "@/domain/validation";

export const STORAGE_KEY = "lifequest:state";
export type StorageErrorCode = "invalid-json" | "invalid-data" | "unsupported-version" | "unavailable" | "write-failed" | "conflict";
export class RepositoryError extends Error {
  constructor(public readonly code: StorageErrorCode, message: string) { super(message); this.name = "RepositoryError"; }
}
export interface Repository {
  load(): Promise<AppSnapshot | null>;
  save(next: AppSnapshot, expectedRevision: number): Promise<void>;
}
export type StoragePort = Pick<Storage, "getItem" | "setItem">;

export class LocalStorageRepository implements Repository {
  constructor(private readonly getStorage: () => StoragePort = () => window.localStorage) {}
  async load(): Promise<AppSnapshot | null> {
    let raw: string | null;
    try { raw = this.getStorage().getItem(STORAGE_KEY); }
    catch { throw new RepositoryError("unavailable", "无法访问本地存储。请检查浏览器设置后重试。"); }
    if (raw === null) return null;
    let decoded: unknown;
    try { decoded = JSON.parse(raw); }
    catch { throw new RepositoryError("invalid-json", "本地数据无法解析；原始数据已保留，请勿清除站点数据。"); }
    return this.validate(decoded);
  }
  private validate(value: unknown) {
    try { return parseSnapshot(value); }
    catch (error) {
      if (error instanceof SnapshotValidationError) throw new RepositoryError(error.code, error.message);
      throw new RepositoryError("invalid-data", "本地数据结构无效；原始数据已保留。");
    }
  }
  async save(next: AppSnapshot, expectedRevision: number): Promise<void> {
    this.validate(next);
    const current = await this.load(); // Invalid stored content blocks all writes.
    if ((current?.revision ?? 0) !== expectedRevision) throw new RepositoryError("conflict", "其他页面已修改数据，请重新读取后再操作。");
    if (next.revision !== expectedRevision + 1) throw new RepositoryError("invalid-data", "保存版本必须逐次递增。");
    try { this.getStorage().setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new RepositoryError("write-failed", "保存失败，可能空间不足或存储被禁用。当前修改尚未保存，可重试。"); }
  }
}
