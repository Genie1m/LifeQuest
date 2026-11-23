import {ReplanWorkspace} from '@/components/replan-workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ReplanWorkspace id={id}/>;}
