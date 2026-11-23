import { Suspense } from "react";
import { AdventureHall } from "@/components/quest-pages";
export default function Page() { return <Suspense fallback={<p role="status">正在准备冒险大厅…</p>}><AdventureHall /></Suspense>; }
