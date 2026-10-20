"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emptySnapshot, type AppSnapshot } from "@/domain/types";
import { LocalStorageRepository, RepositoryError, STORAGE_KEY, type Repository } from "@/services/repository";

export interface AppState {
  status: "loading" | "ready" | "error";
  snapshot: AppSnapshot | null;
  error: RepositoryError | null;
  saving: boolean;
  blocked: boolean;
}
interface AppContextValue extends AppState {
  reload: () => Promise<void>;
  save: (update: (current: AppSnapshot) => AppSnapshot) => Promise<boolean>;
}
const initialState: AppState = { status: "loading", snapshot: null, error: null, saving: false, blocked: false };
const Context = createContext<AppContextValue | null>(null);
const storageRepository = new LocalStorageRepository(); // No browser API access until load/save.
function asError(error: unknown) {
  return error instanceof RepositoryError ? error : new RepositoryError("unavailable", "本地状态操作失败，请重试。");
}

export function AppProvider({ children, repository = storageRepository }: { children: ReactNode; repository?: Repository }) {
  const [state, setState] = useState<AppState>(initialState);
  const current = useRef(state);
  const alive = useRef(false);
  const generation = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const invalidate = useCallback(() => { generation.current += 1; }, []);
  const publish = useCallback((next: AppState) => {
    if (!alive.current) return;
    current.current = next; setState(next);
  }, []);

  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    await queue.current; // Do not let an older queued save race a reload.
    if (!alive.current || ticket !== generation.current) return;
    publish({ ...initialState });
    try {
      const snapshot = await repository.load();
      if (alive.current && ticket === generation.current) publish({ ...initialState, status: "ready", snapshot: snapshot ?? emptySnapshot() });
    } catch (error) {
      if (alive.current && ticket === generation.current) publish({ ...initialState, status: "error", error: asError(error), blocked: true });
    }
  }, [repository, publish]);

  useEffect(() => {
    alive.current = true;
    void reload();
    function externalChange(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      invalidate();
      publish({ ...current.current, saving: false, blocked: true,
        error: new RepositoryError("conflict", "检测到其他页面修改了数据。请重新读取后再继续。") });
    }
    window.addEventListener("storage", externalChange);
    return () => { alive.current = false; invalidate(); window.removeEventListener("storage", externalChange); };
  }, [reload, publish, invalidate]);

  const save = useCallback((update: (current: AppSnapshot) => AppSnapshot): Promise<boolean> => {
    const ticket = generation.current;
    const operation = queue.current.then(async () => {
      const before = current.current;
      if (!alive.current || ticket !== generation.current || before.status !== "ready" || !before.snapshot || before.blocked) return false;
      publish({ ...before, saving: true, error: null });
      try {
        const next = { ...update(structuredClone(before.snapshot)), revision: before.snapshot.revision + 1 };
        await repository.save(next, before.snapshot.revision);
        if (!alive.current || ticket !== generation.current) return false;
        publish({ ...before, snapshot: next, saving: false, error: null });
        return true;
      } catch (error) {
        if (alive.current && ticket === generation.current) {
          const failure = asError(error);
          publish({ ...before, saving: false, error: failure, blocked: failure.code !== "write-failed" });
        }
        return false;
      }
    });
    queue.current = operation.catch(() => undefined);
    return operation;
  }, [repository, publish]);
  const value = useMemo(() => ({ ...state, reload, save }), [state, reload, save]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppState() {
  const context = useContext(Context);
  if (!context) throw new Error("useAppState must be used inside AppProvider");
  return context;
}
