import { OpenAIAdapter, boundedText, parsePlanningInput } from "@/services/planner/server";
import { PlannerError } from "@/services/planner/types";
import { CompatibleAdapter } from "@/services/planner/compatible";
import { localRequestError } from "@/services/planner/local-request";
import {PLANNER_VERSIONS} from '@/services/planner/versions';
export const runtime="nodejs";
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
let concurrent=0;let period=0;let calls=0; // Counters only: never credentials or prompt data.
export async function POST(request:Request){
  const started=performance.now();const requestId=crypto.randomUUID();
  let occupied=false;
  try{
    if(process.env.NODE_ENV!=="development"||process.env.LIFEQUEST_ENABLE_REAL_LLM!=="true")return Response.json({code:"disabled",message:"真实模型接口仅在明确启用的本地开发环境可用。"},{status:403,headers});
    const requestError=localRequestError(request);
    if(requestError)return Response.json({code:"disabled",message:requestError},{status:403,headers});
    const now=Date.now();if(now-period>60_000){period=now;calls=0;}if(concurrent>=2||calls>=20)return Response.json({code:"rate-limit",message:"本机请求过于频繁，请稍后重试。"},{status:429,headers});
    const key=request.headers.get("x-lifequest-api-key");if(!key||key.length>512||!/^\S+$/.test(key))return Response.json({code:"authentication",message:"请在模型设置中配置有效凭据。"},{status:400,headers});
    concurrent++;calls++;occupied=true;
    const raw=await boundedText({body:request.body},64*1024);let body;try{body=JSON.parse(raw);}catch{throw new PlannerError("invalid-request","请求不是有效 JSON。");}
    if(!body||!['test','generate'].includes(body.operation)||typeof body.model!=="string"||Object.keys(body).some(k=>!["operation","model","input","provider","connection"].includes(k)))throw new PlannerError("invalid-request","请求字段无效。");
    const provider=body.provider??'openai';
    if(!['openai','qwen','compatible'].includes(provider)||(provider==='openai'&&body.connection!==undefined))throw new PlannerError('invalid-request','服务商或连接设置无效。');
    const adapter=provider==='openai'?new OpenAIAdapter(key,body.model):new CompatibleAdapter(key,body.model,provider,body.connection);
    const result=body.operation==="test"?await adapter.test(request.signal):await adapter.generate(parsePlanningInput(body.input),request.signal);
    return Response.json({...result,...(body.operation==='generate'?{versions:PLANNER_VERSIONS}:{})},{headers});
  }catch(e){const error=e instanceof PlannerError?e:new PlannerError("invalid-request","请求无法处理，请检查输入或稍后重试。");return Response.json({code:error.code,message:error.message,requestId,elapsedMs:Math.round(performance.now()-started),...(error.upstreamStatus?{upstreamStatus:error.upstreamStatus}:{}),...(error.validationIssue?{validationIssue:error.validationIssue}:{})},{status:error.code==="timeout"?504:error.code==="invalid-request"?400:502,headers});}
  finally{if(occupied)concurrent--;}
}
