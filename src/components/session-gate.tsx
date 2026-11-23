"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppState } from "@/state/AppProvider";

export function SessionGate({ children }: { children: ReactNode }) {
  const state = useAppState(); const path = usePathname(); const router = useRouter();
  const redirect = state.status === "ready" && !!state.snapshot && !state.snapshot.character && path !== "/onboarding" && path !== "/settings/models";
  useEffect(() => { if (redirect) router.replace("/onboarding"); }, [redirect, router]);
  if (state.status !== "ready" || !state.snapshot || redirect) return null;
  return children;
}
