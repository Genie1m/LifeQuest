import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/state/AppProvider";
import { RepositoryError, STORAGE_KEY, type Repository } from "@/services/repository";
import { StorageFeedback } from "./feedback";

describe("StorageFeedback", () => {
  it("renders a readable error and retry action after load failure", async () => {
    const repository: Repository = { load: vi.fn().mockRejectedValue(new RepositoryError("invalid-json", "原始数据已保留")), save: vi.fn() };
    render(<AppProvider repository={repository}><StorageFeedback /></AppProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent("原始数据已保留");
    expect(screen.getByRole("button", { name: "重新读取" })).toBeEnabled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("does not hide a cross-tab conflict behind an initial loading indicator", () => {
    const repository: Repository = { load: vi.fn(() => new Promise<null>(() => {})), save: vi.fn() };
    render(<AppProvider repository={repository}><StorageFeedback /></AppProvider>);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "external change" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("其他页面修改了数据");
    expect(screen.queryByText("正在读取冒险档案")).not.toBeInTheDocument();
  });
});
