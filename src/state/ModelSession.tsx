"use client";
import {createContext,useContext,useRef,useState,useEffect,type ReactNode} from "react";
import {OPENAI_MODELS} from "@/services/planner/catalog";
import {MockPlanner} from "@/services/planner/mock";
import {PlannerError,type PlannerResult} from "@/services/planner/types";
import type {PlanningInput} from "@/domain/proposal";
import {parseModelProposal} from '@/services/planner/proposal-output';
import {defaultConnection,type ConnectionOptions} from '@/services/planner/connection';
interface Session {provider:string;model:string;connection:ConnectionOptions;configured:boolean;epoch:number;configure:(provider:string,model:string,key:string,connection?:ConnectionOptions)=>void;clear:()=>void;invoke:(operation:"test"|"generate",input?:PlanningInput,signal?:AbortSignal)=>Promise<PlannerResult|{elapsedMs:number}>}
const Context=createContext<Session|null>(null);
export function ModelSessionProvider({children}:{children:ReactNode}){
  const [provider,setProvider]=useState("openai");const [model,setModel]=useState<string>(OPENAI_MODELS[0].id);const [configured,setConfigured]=useState(false);const [epoch,setEpoch]=useState(0);
  const secret=useRef("");const version=useRef(0);const requests=useRef(new Set<AbortController>());
  const [connection,setConnection]=useState<ConnectionOptions>(defaultConnection('openai'));
  function clear(){secret.current="";version.current++;setEpoch(version.current);setConfigured(false);for(const c of requests.current)c.abort();requests.current.clear();}
  function configure(nextProvider:string,nextModel:string,key:string,options=defaultConnection(nextProvider)){clear();setProvider(nextProvider);setModel(nextModel);setConnection(options);if(['openai','qwen','compatible'].includes(nextProvider)){secret.current=key.trim();setConfigured(!!secret.current);}}
  useEffect(()=>{const active=requests.current;return()=>{secret.current="";for(const c of active)c.abort();active.clear();};},[]);
  async function invoke(operation:"test"|"generate",input?:PlanningInput,signal?:AbortSignal){
    const ticket=version.current;const controller=new AbortController();requests.current.add(controller);const timeout=AbortSignal.timeout(135_000);const combined=AbortSignal.any([controller.signal,timeout,...(signal?[signal]:[])]);
    try{
      if(provider==="mock"){const adapter=new MockPlanner();const result=operation==="test"?await adapter.test():await adapter.generate(input!,combined);if(combined.aborted||ticket!==version.current)throw new PlannerError("cancelled","请求已取消。");return result;}
      if(!['openai','qwen','compatible'].includes(provider))throw new PlannerError("disabled","此服务商将在下一阶段接入。");
      if(!secret.current)throw new PlannerError("authentication","请先在模型设置中配置凭据。");
      const response=await fetch("/api/planner",{method:"POST",cache:"no-store",redirect:"error",signal:combined,headers:{"Content-Type":"application/json","x-lifequest-api-key":secret.current},body:JSON.stringify({operation,model,provider,...(provider!=='openai'?{connection}:{}),...(input?{input}:{})})});
      const text=await response.text();if(new TextEncoder().encode(text).length>128*1024)throw new PlannerError("invalid-response","响应过大。");let result;try{result=JSON.parse(text);}catch{throw new PlannerError("invalid-response","本机接口未返回有效 JSON。");}
      if(ticket!==version.current||combined.aborted)throw new PlannerError("cancelled","凭据已清除或请求已取消，结果已忽略。");
      if(!response.ok)throw new PlannerError(result.code??"server",`${typeof result.message==='string'?result.message:'请求失败。'}${typeof result.requestId==='string'?`（请求 ${result.requestId}；耗时 ${result.elapsedMs}ms${Number.isInteger(result.upstreamStatus)?`；上游HTTP ${result.upstreamStatus}`:''}）`:''}`,result.upstreamStatus);
      if(typeof result.elapsedMs!=="number"||result.elapsedMs<0)throw new PlannerError("invalid-response","响应统计无效。");
      if(operation==="generate"){parseModelProposal(result.proposal);if(result.source!==provider)throw new PlannerError("invalid-response","结果来源不符合当前服务商。");}
      return result as PlannerResult|{elapsedMs:number};
    }catch(e){if(timeout.aborted)throw new PlannerError("timeout","请求超时。");if(combined.aborted)throw new PlannerError("cancelled","请求已取消。");if(e instanceof PlannerError)throw e;throw new PlannerError("network","无法连接本机模型接口；未导入任何结果。");}
    finally{requests.current.delete(controller);}
  }
  return <Context.Provider value={{provider,model,connection,configured,epoch,configure,clear,invoke}}>{children}</Context.Provider>;
}
export function useModelSession(){const value=useContext(Context);if(!value)throw new Error("ModelSessionProvider required");return value;}
