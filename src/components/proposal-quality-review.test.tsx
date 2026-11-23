import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {ProposalQualityReview} from './proposal-quality-review';
import type {PlanProposal} from '@/domain/proposal';
const proposal:PlanProposal={reasoning:'逐项交付',assumptions:[],warnings:[],stages:[{ref:'s',title:'实际练习',milestone:'留下实际证据',checkpointRef:'t',tasks:[{ref:'t',title:'录制实际练习',description:'1. 执行。\n2. 复盘。',doneCriteria:'保存录制与具体观察。',estimatedMinutes:30,difficulty:'standard'}]}]};
it('shows exact request conditions, observation duration and actionable advisory findings without claiming a score',()=>{
 render(<ProposalQualityReview proposal={proposal} weeklyHours={5} input={{successCriteria:'完成三份练习记录',preferences:'每次20分钟',requirements:'先实践4周'}}/>);
 expect(screen.getByText('完成三份练习记录')).toBeInTheDocument();expect(screen.getByText('每次20分钟')).toBeInTheDocument();
 expect(screen.getByText(/超过你填写的单次 20 分钟/)).toBeInTheDocument();expect(screen.getByText(/工作量推算的周数不包含/)).toBeInTheDocument();
 expect(screen.queryByText('内容合格')).not.toBeInTheDocument();expect(screen.getByText(/系统不会自动修改/)).toBeInTheDocument();
});
