"use client";
import Link from 'next/link';
import {useState,useRef} from 'react';
import {useModelSession} from '@/state/ModelSession';
import {OPENAI_MODELS,PROVIDERS} from '@/services/planner/catalog';
import {defaultModel,defaultConnection,QWEN_BASES,RELAY_BASE,type ConnectionOptions} from '@/services/planner/connection';
import {PlannerError} from '@/services/planner/types';
import {Button} from './ui/button';
import {PageHeading} from './quest-ui';
export function ModelSettings({returnTo}:{returnTo?:string}={}){
 const session=useModelSession();const [input,setInput]=useState('');const [message,setMessage]=useState('');const [pending,setPending]=useState(false);const lock=useRef(false);const operation=useRef(0);
 const real=['openai','qwen','compatible'].includes(session.provider);
 function reset(){operation.current++;session.clear();setInput('');setMessage('凭据已清除；进行中的请求已取消。');setPending(false);lock.current=false;}
 function change(model=session.model,connection=session.connection){reset();session.configure(session.provider,model,'',connection);setMessage('连接设置已变更，请重新配置会话凭据。');}
 function options(patch:Partial<ConnectionOptions>){change(session.model,{...session.connection,...patch});}
 async function test(){if(lock.current)return;lock.current=true;setPending(true);const ticket=++operation.current;setMessage('');try{const r=await session.invoke('test');if(ticket===operation.current)setMessage(session.provider==='mock'?'演示模板测试通过（未调用真实 AI）。':`真实模型生成测试成功，耗时 ${r.elapsedMs} ms。后续计划生成仍可能失败。`);}catch(e){if(ticket===operation.current)setMessage(e instanceof PlannerError?`${e.code}：${e.message}`:'测试失败。');}finally{if(ticket===operation.current){setPending(false);lock.current=false;}}}
 return <><PageHeading eyebrow="MODEL SETTINGS / 本次会话" title="为成长路线选择模型">凭据仅在此标签页的应用内存中使用；普通客户端页面切换保留，完全刷新需重新输入。</PageHeading>
 <section className="quest-card creation-form model-settings">
 <label className="field">模型服务商<select value={session.provider} onChange={e=>{reset();session.configure(e.target.value,defaultModel(e.target.value),'',defaultConnection(e.target.value));}}>{PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {real?<>
 {session.provider==='openai'?<label className="field">支持的模型<select value={session.model} disabled={pending} onChange={e=>change(e.target.value)}>{OPENAI_MODELS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>:<>
 {session.provider==='qwen'?<label className="field">百炼地域<select value={session.connection.baseUrl} onChange={e=>options({baseUrl:e.target.value})}><option value={QWEN_BASES[0]}>北京 · Key须匹配地域</option><option value={QWEN_BASES[1]}>新加坡 · Key须匹配地域</option></select></label>:<>
 <label className="field">Base URL<input type="url" value={session.connection.baseUrl} onChange={e=>options({baseUrl:e.target.value})} placeholder="https://provider.example/v1" autoComplete="off"/></label>
 <p className="field-hint">填写 API 根地址，不加 /responses 或 /chat/completions。已预置信任你提供的 {RELAY_BASE}；其他 HTTPS 地址需加入本机服务端信任清单后重启。</p>
 <label className="field">接口协议<select value={session.connection.protocol} onChange={e=>options({protocol:e.target.value as ConnectionOptions['protocol']})}><option value="responses">Responses · 截图中转站</option><option value="chat">Chat Completions · 常见 Qwen 中转</option></select></label>
 <label className="field">输出模式<select value={session.connection.outputMode} onChange={e=>options({outputMode:e.target.value as ConnectionOptions['outputMode']})}><option value="json_schema">严格 JSON Schema（服务商须支持）</option><option value="json_object">JSON Object（本地仍严格校验）</option></select></label>
 {session.connection.protocol==='chat'&&<label className="focus-choice"><input type="checkbox" checked={session.connection.disableThinking??false} onChange={e=>options({disableThinking:e.target.checked})}/>添加 enable_thinking=false（仅在 Qwen 中转文档要求时勾选）</label>}
 </>}
 <label className="field">模型 ID<input value={session.model} readOnly={session.provider==='qwen'} onChange={e=>change(e.target.value)} autoComplete="off"/></label>
 {session.provider==='compatible'&&<p className="field-hint">默认 gpt-6.1-sol 为你指定的 GPT-6.1 Sol 候选。Qwen 中转请填该站实际模型 ID 并选择其支持协议；预设不代表模型权限或结构化能力已验证。</p>}
 </>}
 <label className="field">API Key<input type="password" autoComplete="off" spellCheck={false} value={input} onChange={e=>setInput(e.target.value)} placeholder="只在此页面输入，不要发到聊天中"/></label>
 <Button disabled={!input.trim()||pending} onClick={()=>{session.configure(session.provider,session.model,input,session.connection);setInput('');setMessage('已配置当前会话凭据，尚未测试连接。');}}>配置到当前会话</Button>
 <p role="status">{session.configured?'当前会话：已配置凭据':'当前会话：未配置凭据'}</p>
 </>:session.provider==='mock'?<p>当前是演示模板，不需要密钥，不会发送供应商请求。</p>:<p>下一阶段接入；本版无法连接此服务商。</p>}
 <div className="action-row"><Button disabled={pending||(!session.configured&&session.provider!=='mock')||(!real&&session.provider!=='mock')} onClick={()=>void test()}>{pending?'正在测试…':'测试连接'}</Button><Button variant="outline" onClick={reset}>清除当前凭据</Button></div><p role="status">{message}</p>
 <p className="local-notice">真实调用仅限本机开发：先设置 LIFEQUEST_ENABLE_REAL_LLM=true 再启动 npm run dev；403 通常表示开关或同源限制未满足。测试会执行最小生成并可能收费，Key由LifeQuest本机服务端发往所选供应商；中转站会收到Key和生成时的目标内容。Key和连接配置不存业务档案或浏览器持久化。内存不承诺安全擦除。无需cc-switch，不读取或修改本地Codex配置。</p>
 {returnTo&&<Button asChild><Link href={returnTo}>返回这份重新规划 →</Link></Button>}<Link className="text-link" href="/goals">返回冒险日志 →</Link></section></>;
}
