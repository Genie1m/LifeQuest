export interface ConnectionOptions {baseUrl:string;protocol:'responses'|'chat';outputMode:'json_schema'|'json_object';disableThinking?:boolean}
export const QWEN_BASES=['https://dashscope.aliyuncs.com/compatible-mode/v1','https://dashscope-intl.aliyuncs.com/compatible-mode/v1'];
export const RELAY_BASE='https://api.aicodemirror.ai/v1';
export const DEFAULT_CONNECTION:ConnectionOptions={baseUrl:RELAY_BASE,protocol:'responses',outputMode:'json_schema'};
export function defaultModel(provider:string){return provider==='qwen'?'qwen-plus':provider==='compatible'?'gpt-6.1-sol':'gpt-5.6-terra';}
export function defaultConnection(provider:string):ConnectionOptions{return provider==='qwen'?{baseUrl:QWEN_BASES[0],protocol:'chat',outputMode:'json_object'}:{...DEFAULT_CONNECTION};}
export function normalizeBase(value:string){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||u.hostname.endsWith('.local'))throw new Error('invalid endpoint');
 return u.href.replace(/\/+$/,'');
}
