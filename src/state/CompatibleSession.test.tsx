import {act,fireEvent,render,screen} from '@testing-library/react';
import {useLayoutEffect} from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {ModelSessionProvider,useModelSession} from './ModelSession';
import {ModelSettings} from '@/components/model-settings';
import {defaultConnection,RELAY_BASE} from '@/services/planner/connection';
import {MockPlanner} from '@/services/planner/mock';
import {EVALUATION_CASES} from '@/services/planner/evaluation-cases';
let session:ReturnType<typeof useModelSession>;
function Capture(){const value=useModelSession();useLayoutEffect(()=>{session=value;},[value]);return null;}
afterEach(()=>vi.restoreAllMocks());
describe('compatible connection session',()=>{
 it('sends configuration but no key in JSON and validates selected result source',async()=>{const r=await new MockPlanner().generate(EVALUATION_CASES[0]);const network=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({...r,source:'compatible'}));render(<ModelSessionProvider><Capture/></ModelSessionProvider>);await act(async()=>session.configure('compatible','gpt-6.1-sol','volatile-relay-key',defaultConnection('compatible')));const result=await session.invoke('generate',EVALUATION_CASES[0]);expect(result).toHaveProperty('source','compatible');const body=network.mock.calls[0][1]!.body as string;expect(JSON.parse(body)).toMatchObject({provider:'compatible',model:'gpt-6.1-sol',connection:{baseUrl:RELAY_BASE}});expect(body).not.toContain('volatile-relay-key');network.mockResolvedValue(Response.json({...r,source:'qwen'}));await expect(session.invoke('generate',EVALUATION_CASES[0])).rejects.toMatchObject({code:'invalid-response'});});
 it('prefills the user relay and resets credentials when model/protocol changes',()=>{render(<ModelSessionProvider><Capture/><ModelSettings/></ModelSessionProvider>);fireEvent.change(screen.getByLabelText('模型服务商'),{target:{value:'compatible'}});expect(screen.getByLabelText('Base URL')).toHaveValue(RELAY_BASE);expect(screen.getByLabelText('模型 ID')).toHaveValue('gpt-6.1-sol');fireEvent.change(screen.getByLabelText('API Key'),{target:{value:'volatile-relay-key'}});fireEvent.click(screen.getByRole('button',{name:'配置到当前会话'}));expect(session.configured).toBe(true);fireEvent.change(screen.getByLabelText('接口协议'),{target:{value:'chat'}});expect(session.configured).toBe(false);expect(screen.getByLabelText('API Key')).toHaveValue('');fireEvent.change(screen.getByLabelText('模型 ID'),{target:{value:'qwen-custom'}});expect(session.model).toBe('qwen-custom');});
 it('offers real Qwen configuration rather than an upcoming placeholder',()=>{render(<ModelSessionProvider><Capture/><ModelSettings/></ModelSessionProvider>);fireEvent.change(screen.getByLabelText('模型服务商'),{target:{value:'qwen'}});expect(screen.getByLabelText('模型 ID')).toHaveValue('qwen-plus');expect(screen.getByLabelText('百炼地域')).toBeInTheDocument();expect(screen.getByRole('button',{name:'测试连接'})).toBeDisabled();});
});
