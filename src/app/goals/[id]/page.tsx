import { GoalDetail } from "@/components/quest-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <GoalDetail id={id} />; }
