import { ModelSessionProvider } from "@/state/ModelSession";
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {AppProvider} from '@/state/AppProvider';
import {GoalEditor} from './plan-editor';
import {draftFixture} from '@/test/fixtures';
import {readyDraft} from '@/test/multi-fixtures';
import {RepositoryError,type Repository} from '@/services/repository';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
function setup(fail=false){const s=draftFixture();s.goals=[readyDraft(1)];const stage=s.goals[0].draft!.content.stages[0];stage.checkpointTaskId=stage.tasks[0].id;const repo:Repository={load:vi.fn().mockResolvedValue(s),save:vi.fn().mockResolvedValue(undefined)};if(fail)vi.mocked(repo.save).mockRejectedValueOnce(new RepositoryError('write-failed','quota'));render(<ModelSessionProvider><AppProvider repository={repo}><GoalEditor id={s.goals[0].id}/></AppProvider></ModelSessionProvider>);return {s,repo};}
describe('confirmation UI',()=>{
 it('refuses unsaved edits and retains typed content',async()=>{const {repo}=setup();fireEvent.change(await screen.findByLabelText('真实任务标题'),{target:{value:'未保存'}});fireEvent.click(screen.getByRole('button',{name:'预览并开启冒险'}));await screen.findByText('请先保存当前修改，再预览并开启冒险。');expect(screen.queryByRole('button',{name:'确认并开启冒险'})).toBeNull();expect(repo.save).not.toHaveBeenCalled();});
 it('does not signal success on write failure and retries without losing the draft',async()=>{const {s,repo}=setup(true);fireEvent.click(await screen.findByRole('button',{name:'预览并开启冒险'}));fireEvent.click(screen.getByRole('button',{name:'确认并开启冒险'}));await screen.findByText(/保存失败，冒险尚未开启/);expect(screen.queryByText('冒险已开启！')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'确认并开启冒险'}));await screen.findByText('冒险已开启！');expect(vi.mocked(repo.save).mock.calls[1][0].goals[0].confirmedPlan!.content).toEqual(s.goals[0].draft!.content);expect(screen.queryByRole('button',{name:'保存草稿'})).toBeNull();});
 it('publishes one formal plan after duplicate clicks',async()=>{const {repo}=setup();fireEvent.click(await screen.findByRole('button',{name:'预览并开启冒险'}));const button=screen.getByRole('button',{name:'确认并开启冒险'});fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(repo.save).toHaveBeenCalledTimes(1));});
});
