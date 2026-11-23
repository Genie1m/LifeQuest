import {PROPOSAL_SCHEMA,type PlanningInput} from '@/domain/proposal';
import {outputInstructions} from './instructions';
import {parseModelProposal} from './proposal-output';
import {readSupplierResponse} from './server';
import {PlannerError,type RealityPlanner,type PlannerResult} from './types';
import {normalizeBase,QWEN_BASES,RELAY_BASE,type ConnectionOptions} from './connection';
export function validateConnection(provider:string,model:string,raw:unknown):ConnectionOptions {
 try{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error();
  const c=raw as ConnectionOptions;if(Object.keys(c).some(k=>!['baseUrl','protocol','outputMode','disableThinking'].includes(k))||typeof c.baseUrl!=='string'||(c.disableThinking!==undefined&&typeof c.disableThinking!=='boolean')||!['chat','responses'].includes(c.protocol)||!['json_schema','json_object'].includes(c.outputMode)||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(model))throw new Error();
  const baseUrl=normalizeBase(c.baseUrl);
  const approved=provider==='qwen'?QWEN_BASES:provider==='compatible'?[RELAY_BASE,...(process.env.LIFEQUEST_TRUSTED_LLM_BASE_URLS??'').split(',').filter(Boolean).map(normalizeBase)]:[];
  if(!approved.includes(baseUrl))throw new PlannerError('disabled','此 Base URL 未获服务端信任。仅在本机 .env.local 的 LIFEQUEST_TRUSTED_LLM_BASE_URLS 添加准确地址（不含Key）并重启；不要填写不信任的站点。');
  if(provider==='qwen'&&(c.protocol!=='chat'||c.outputMode!=='json_object'||model!=='qwen-plus'))throw new Error();
  return {...c,baseUrl};
 }catch(e){if(e instanceof PlannerError)throw e;throw new PlannerError('invalid-request','请检查 HTTPS Base URL、模型 ID、协议与输出格式。Qwen 预设使用 qwen-plus / Chat Completions / JSON Object。');}
}
export class CompatibleAdapter implements RealityPlanner {
 private connection:ConnectionOptions;
 constructor(private key:string,private model:string,private provider:'qwen'|'compatible',options:ConnectionOptions,private request:typeof fetch=fetch,private timeoutMs=120_000){this.connection=validateConnection(provider,model,options);}
 private async call(schema:object,input:string,maxTokens:number,signal?:AbortSignal,planning=true,planningInput?:PlanningInput){
  const c=this.connection;const timeout=AbortSignal.timeout(this.timeoutMs);const combined=AbortSignal.any([timeout,...(signal?[signal]:[])]);const start=performance.now();
  const instructions=outputInstructions(schema,planning,planningInput);const format=c.outputMode==='json_schema'?{type:'json_schema',name:'lifequest_plan',strict:true,schema}:{type:'json_object'};
  const body=c.protocol==='responses'?{model:this.model,store:false,stream:false,max_output_tokens:maxTokens,instructions,input,text:{format}}:{model:this.model,stream:false,max_tokens:maxTokens,messages:[{role:'system',content:instructions},{role:'user',content:input}],response_format:c.outputMode==='json_schema'?{type:'json_schema',json_schema:{name:'lifequest_plan',strict:true,schema}}:format,...((this.provider==='qwen'||c.disableThinking===true)?{enable_thinking:false}:{})};
  try{
   const response=await this.request(`${c.baseUrl}/${c.protocol==='responses'?'responses':'chat/completions'}`,{method:'POST',redirect:'error',cache:'no-store',signal:combined,headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await readSupplierResponse(response,this.timeoutMs);
   let text='';let u;
   if(c.protocol==='chat'){
    const choice=data.choices?.[0];if(choice?.finish_reason!=='stop'||choice?.message?.refusal||typeof choice?.message?.content!=='string')throw new PlannerError('invalid-response','Chat 响应未完整结束、被拒绝或内容格式不支持。');text=choice.message.content;u=data.usage&&{inputTokens:data.usage.prompt_tokens,outputTokens:data.usage.completion_tokens,totalTokens:data.usage.total_tokens};
   }else{
    if(data.status!=='completed'||!Array.isArray(data.output))throw new PlannerError('invalid-response','Responses 输出未完整完成。');
    for(const item of data.output)if(item.type==='message'&&Array.isArray(item.content))for(const part of item.content){if(part.type==='refusal')throw new PlannerError('invalid-response','供应商拒绝生成。');if(part.type==='output_text'&&typeof part.text==='string')text+=part.text;}
    u=data.usage&&{inputTokens:data.usage.input_tokens,outputTokens:data.usage.output_tokens,totalTokens:data.usage.total_tokens};
   }
   let output;try{output=JSON.parse(text);}catch{throw new PlannerError('invalid-response','生成内容不是 JSON；可调整输出模式或手动规划。');}
   const usage=u&&Object.values(u).every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)?u:undefined;
   return {output,usage,elapsedMs:Math.round(performance.now()-start)};
  }catch(e){if(timeout.aborted)throw new PlannerError('timeout','供应商请求超时。');if(signal?.aborted)throw new PlannerError('cancelled','请求已取消。');if(e instanceof PlannerError)throw e;throw new PlannerError('network','无法完成供应商网络请求，不能据此判断Key或余额。');}
 }
 async test(signal?:AbortSignal){const r=await this.call({type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},'Return JSON with ok=true',256,signal,false);if(!r.output||Object.keys(r.output).length!==1||r.output.ok!==true)throw new PlannerError('invalid-response','连接生成测试内容不符合预期。');return {elapsedMs:r.elapsedMs};}
 async generate(input:PlanningInput,signal?:AbortSignal):Promise<PlannerResult>{const r=await this.call(PROPOSAL_SCHEMA,JSON.stringify(input),8192,signal,true,input);return {proposal:parseModelProposal(r.output),elapsedMs:r.elapsedMs,usage:r.usage,source:this.provider};}
}
