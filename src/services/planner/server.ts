import { PROPOSAL_SCHEMA, validateShape, type PlanningInput } from "@/domain/proposal";
import {outputInstructions} from './instructions';
import {parseModelProposal} from './proposal-output';
import { validateGoalInput } from "@/domain/commands";
import { OPENAI_MODELS } from "./catalog";
import { PlannerError, type PlannerResult, type RealityPlanner } from "./types";

export async function boundedText(response: { body: ReadableStream<Uint8Array> | null },max:number,readTimeoutMs=10_000):Promise<string>{
  if(!response.body)throw new PlannerError("invalid-response","响应缺少内容。");const reader=response.body.getReader();let size=0;const decoder=new TextDecoder();let text="";let expired=false;
  const deadline=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>undefined);},readTimeoutMs);
  try{while(true){const {done,value}=await reader.read();if(expired)throw new PlannerError("timeout","读取内容超时。");if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new PlannerError("invalid-response","内容超过安全大小限制。");}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{clearTimeout(deadline);reader.releaseLock();}
}
export function supplierFailure(status:number,code:unknown):PlannerError {
  if(status===408||status===504)return new PlannerError('timeout','上游网关返回超时；请求可能已计费。可稍后手动重试，或减少本次规划范围。');
  if(status===401)return new PlannerError("authentication","密钥认证失败，请在模型设置中重新配置。");
  if(['insufficient_quota','billing_hard_limit_reached','Arrearage','InsufficientBalance'].includes(String(code)))return new PlannerError("quota","供应商明确返回额度或计费限制，请检查账户。");
  if(status===403)return new PlannerError("model-access","供应商拒绝访问，请检查账户权限及地域限制。");
  if(status===404||code==="model_not_found")return new PlannerError("model-access","所选模型不可访问，可能不存在或当前账户没有权限。");
  if(status===429)return new PlannerError("rate-limit","请求被限流；若无明确错误码，无法判断具体账户原因。");
  if(status>=500)return new PlannerError("server","模型服务暂时异常，请稍后重试。");
  return new PlannerError("invalid-request","供应商拒绝了请求参数或能力配置，请检查模型支持情况。");
}
/** Check HTTP status even when a gateway returns HTML instead of JSON. Never echo raw errors. */
export async function readSupplierResponse(response:Response,readTimeoutMs=120_000){
  let data;
  try{data=JSON.parse(await boundedText(response,128*1024,readTimeoutMs));}
  catch(e){if(response.ok){if(e instanceof PlannerError)throw e;throw new PlannerError('invalid-response','供应商成功响应不是有效 JSON，未导入任何数据。');}}
  if(!response.ok){const error=supplierFailure(response.status,data?.error?.code);throw new PlannerError(error.code,error.message,response.status);}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new PlannerError('invalid-response','供应商响应缺少对象结构。');
  return data;
}
export class OpenAIAdapter implements RealityPlanner {
  constructor(private readonly key:string,private readonly model:string,private readonly request:typeof fetch=fetch,private readonly timeoutMs=120_000){}
  private async call(schema:object,instructions:string,input:string,maxTokens:number,signal?:AbortSignal){
    if(!OPENAI_MODELS.some(m=>m.id===this.model))throw new PlannerError("model-access","模型不在本版已验证目录中。");
    const timeout=AbortSignal.timeout(this.timeoutMs);const combined=signal?AbortSignal.any([timeout,signal]):timeout;const start=performance.now();
    try{
      const response=await this.request("https://api.openai.com/v1/responses",{method:"POST",redirect:"error",cache:"no-store",signal:combined,headers:{Authorization:`Bearer ${this.key}`,"Content-Type":"application/json"},body:JSON.stringify({model:this.model,store:false,stream:false,reasoning:{effort:"none"},max_output_tokens:maxTokens,instructions,input,text:{format:{type:"json_schema",name:"lifequest_plan",strict:true,schema}}})});
      const data=await readSupplierResponse(response,this.timeoutMs);
      if(data.status!=="completed"||!Array.isArray(data.output))throw new PlannerError("invalid-response","模型输出未完整完成，可能被截断或拒绝。未导入任何数据。");
      const texts:string[]=[];for(const item of data.output){if(item.type==="message"&&Array.isArray(item.content))for(const part of item.content){if(part.type==="refusal")throw new PlannerError("invalid-response","模型拒绝了本次请求，可调整要求或手动规划。");if(part.type==="output_text"&&typeof part.text==="string")texts.push(part.text);}}
      let output;try{output=JSON.parse(texts.join(""));}catch{throw new PlannerError("invalid-response","模型没有返回有效的结构化内容。");}
      const u=data.usage;const usage=u&&[u.input_tokens,u.output_tokens,u.total_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)?{inputTokens:u.input_tokens,outputTokens:u.output_tokens,totalTokens:u.total_tokens}:undefined;
      return {output,elapsedMs:Math.round(performance.now()-start),usage};
    }catch(e){if(timeout.aborted)throw new PlannerError("timeout","请求超时，未导入任何结果。");if(signal?.aborted)throw new PlannerError("cancelled","请求已取消。");if(e instanceof PlannerError)throw e;throw new PlannerError("network","无法完成供应商网络请求；不能据此判断密钥或账户余额。");}
  }
  async test(signal?:AbortSignal){const schema={type:"object",properties:{ok:{type:"boolean"}},required:["ok"],additionalProperties:false};const r=await this.call(schema,"Return only the requested JSON object with ok=true.","Connection test",128,signal);const o=r.output;if(!o||typeof o!=="object"||Object.keys(o).length!==1||o.ok!==true)throw new PlannerError("invalid-response","测试返回内容不符合预期。");return {elapsedMs:r.elapsedMs};}
  async generate(input:PlanningInput,signal?:AbortSignal):Promise<PlannerResult>{const r=await this.call(PROPOSAL_SCHEMA,outputInstructions(PROPOSAL_SCHEMA,true,input),JSON.stringify(input),8192,signal);return {proposal:parseModelProposal(r.output),elapsedMs:r.elapsedMs,usage:r.usage,source:"openai"};}
}
export function parsePlanningInput(raw:unknown):PlanningInput{
  const schema={type:"object",properties:Object.fromEntries(["title","successCriteria","baseline","direction","weeklyHours","preferences","constraints","requirements"].map(k=>[k,k==="weeklyHours"?{type:"integer",minimum:1,maximum:40}:{type:"string",minLength:["preferences","constraints","requirements"].includes(k)?0:1,maxLength:k==="title"?80:k==="direction"?20:500}])),required:["title","successCriteria","baseline","direction","weeklyHours","preferences","constraints","requirements"],additionalProperties:false};
  // Existing goal hours permit decimals; validate those with the existing domain rule.
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new PlannerError("invalid-request","规划输入无效。");const v=raw as PlanningInput;
  try{const {currentPlan,replanContext,...rest}=v;if(replanContext!==undefined&&(typeof replanContext!=='string'||replanContext.length>12000))throw new Error();if(currentPlan!==undefined&&(typeof currentPlan!=='string'||currentPlan.length>2000))throw new Error();validateShape({...rest,weeklyHours:1},schema);const goal=validateGoalInput(v);return {...goal,preferences:v.preferences,constraints:v.constraints,requirements:v.requirements,...(currentPlan!==undefined?{currentPlan}:{}),...(replanContext!==undefined?{replanContext}:{})};}catch{throw new PlannerError("invalid-request","请检查目标输入、附加要求（各不超过500字）和计划摘要（不超过2000字）或重规划上下文（不超过12000字）。");}
}
