import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {useLayoutEffect} from 'react';
import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {AppProvider,useAppState} from '@/state/AppProvider';
import {executionFixture} from '@/test/execution-fixtures';
import {RepositoryError,type Repository} from '@/services/repository';
import {TaskBoard} from './task-board';
import {CharacterPanel} from './character/character-panel';
import {GrowthJournal} from './growth-journal';
let app:ReturnType<typeof useAppState>;
function Capture(){const a=useAppState();useLayoutEffect(()=>{app=a;},[a]);return null;}
const oldShow=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal'),oldClose=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close');
beforeAll(()=>{Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});});
afterAll(()=>{if(oldShow)Object.defineProperty(HTMLDialogElement.prototype,'showModal',oldShow);else Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');if(oldClose)Object.defineProperty(HTMLDialogElement.prototype,'close',oldClose);else Reflect.deleteProperty(HTMLDialogElement.prototype,'close');});
function setup(data=executionFixture()){
 const repo:Repository={load:vi.fn().mockResolvedValue(data),save:vi.fn().mockResolvedValue(undefined)};
 const view=render(<AppProvider repository={repo}><Capture/><CharacterPanel/><TaskBoard goalId={data.goals[0].id}/><GrowthJournal/></AppProvider>);return {data,repo,...view};
}
async function open(){fireEvent.click(await screen.findByRole('button',{name:'标记完成：录制一次问答练习'}));return screen.getByRole('dialog');}
async function accept(dialog:HTMLElement){fireEvent.click(within(dialog).getByRole('checkbox'));fireEvent.click(within(dialog).getByRole('button',{name:'确认完成并记录成长'}));}

describe('task execution, persistent growth and truthful feedback',()=>{
 it('saves a blocker separately and keeps completion progress and XP at zero',async()=>{
  const {repo}=setup();
  fireEvent.click(await screen.findByRole('button',{name:'记录进展：录制一次问答练习'}));
  const dialog=screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('combobox'),{target:{value:'blocked'}});
  expect(within(dialog).getByRole('button',{name:'保存进展'})).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'尚未找到练习题'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'保存进展'}));
  await screen.findByText('尚未找到练习题');
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('目标任务完成进度')).toHaveAttribute('value','0');
  expect(app.snapshot!.completions).toEqual([]);
  expect(screen.queryByRole('status',{name:'本次成长反馈'})).toBeNull();
  await accept(await open());
  await screen.findByRole('status',{name:'本次成长反馈'});
  expect(screen.getByText('检查点已达成。还有 1 项任务待完成。')).toBeInTheDocument();
 });
 it('requires confirmation and does not save just for opening or cancelling a task',async()=>{
  const {repo}=setup();const dialog=await open();expect(within(dialog).getByRole('button',{name:'确认完成并记录成长'})).toBeDisabled();fireEvent.click(within(dialog).getByRole('button',{name:'继续任务，暂不提交'}));expect(repo.save).not.toHaveBeenCalled();expect(app.snapshot!.completions).toEqual([]);expect(screen.queryByRole('status',{name:'本次成长反馈'})).toBeNull();
 });
 it('persists task and XP once; repeated clicks cannot submit twice',async()=>{
  const {repo}=setup();const dialog=await open();fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'录音与复盘已保留'}});fireEvent.click(within(dialog).getByRole('checkbox'));const button=within(dialog).getByRole('button',{name:'确认完成并记录成长'});fireEvent.click(button);fireEvent.click(button);
  await screen.findByRole('status',{name:'本次成长反馈'});expect(repo.save).toHaveBeenCalledTimes(1);expect(app.snapshot!.completions).toHaveLength(1);expect(app.snapshot!.completions[0]).toMatchObject({xp:20,note:'录音与复盘已保留'});expect(screen.getByLabelText('目标任务完成进度')).toHaveAttribute('value','1');expect(screen.getByRole('heading',{name:'踏出第一步'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'标记完成：录制一次问答练习'})).toBeNull();
 });
 it('preserves note and entire previous state on write failure, then retries without duplicate reward',async()=>{
  const {repo}=setup();vi.mocked(repo.save).mockRejectedValueOnce(new RepositoryError('write-failed','disk full'));const dialog=await open();const before=JSON.stringify(app.snapshot);fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'不要丢失的成果记录'}});await accept(dialog);
  await screen.findByText(/任务和XP均未提交/);expect(JSON.stringify(app.snapshot)).toBe(before);expect(within(dialog).getByRole('textbox')).toHaveValue('不要丢失的成果记录');expect(screen.queryByRole('status',{name:'本次成长反馈'})).toBeNull();fireEvent.click(within(dialog).getByRole('button',{name:'确认完成并记录成长'}));await screen.findByRole('status',{name:'本次成长反馈'});expect(repo.save).toHaveBeenCalledTimes(2);expect(app.snapshot!.completions).toHaveLength(1);
 });
 it.each(['paused','revision'] as const)('prevents completion during %s',async mode=>{
  const data=executionFixture();if(mode==='paused'){data.goals[0].status='paused';delete data.focusGoalId;}else data.goals[0].draft={source:'manual',baseRevision:1,updatedAt:'2026-11-20T10:00:00.000Z',content:{stages:[]}};
  const {repo}=setup(data);expect(await screen.findByRole('button',{name:'标记完成：录制一次问答练习'})).toBeDisabled();expect(repo.save).not.toHaveBeenCalled();
 });
 it('rejects a stale open confirmation after another state change to the goal',async()=>{
  setup();const dialog=await open();await act(async()=>{await app.save(s=>({...s,goals:s.goals.map(g=>({...g,confirmedPlan:{...g.confirmedPlan!,revision:2}}))}));});await accept(dialog);await screen.findByText(/确认已过期/);expect(app.snapshot!.completions).toEqual([]);
 });
 it('allows the character motion to be turned off without altering business data',async()=>{
  const data=executionFixture();data.character!.avatarId='ranger';setup(data);const button=await screen.findByRole('button',{name:'关闭角色动效'});const before=JSON.stringify(app.snapshot);expect(button).toHaveAttribute('aria-pressed','true');fireEvent.click(button);expect(screen.getByRole('button',{name:'开启角色动效'})).toHaveAttribute('aria-pressed','false');expect(JSON.stringify(app.snapshot)).toBe(before);
 });
 it('shows real level up and completion, then reloads without replaying reward feedback',async()=>{
  const {repo,data,unmount}=setup();for(const name of ['录制一次问答练习','完成一份试讲提纲','录制模拟试讲']){fireEvent.click(await screen.findByRole('button',{name:`标记完成：${name}`}));await accept(screen.getByRole('dialog'));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());}
  expect(app.snapshot!.goals[0].status).toBe('completed');expect(app.snapshot!.focusGoalId).toBeUndefined();expect(screen.getByRole('heading',{name:'升级！Lv.1 → Lv.2'})).toBeInTheDocument();expect(repo.save).toHaveBeenCalledTimes(3);expect(data.completions).toEqual([]);expect(screen.getByLabelText('当前等级经验进度')).toHaveAttribute('value','20');
  const saved=structuredClone(app.snapshot!);unmount();setup(saved);await screen.findByRole('heading',{name:'冒险已完成'});expect(screen.queryByRole('status',{name:'本次成长反馈'})).toBeNull();expect(screen.getByLabelText('当前等级经验进度')).toHaveAttribute('value','20');
 });
});
