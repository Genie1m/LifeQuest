import {ModelSettings} from "@/components/model-settings";
export default async function Page({searchParams}:{searchParams:Promise<{returnTo?:string}>}){const {returnTo}=await searchParams;const safe=typeof returnTo==='string'&&/^\/goals\/[0-9a-f-]{36}\/replan$/.test(returnTo)?returnTo:undefined;return <ModelSettings returnTo={safe}/>;}
