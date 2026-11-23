import {describe, expect, it} from 'vitest';
import {estimateWork} from './plan-estimates';
import {proposalReview} from './plan-quality';
import {parseProposal} from './proposal';

describe('planning review', () => {
  it('calculates minimum weeks from the workload and includes fractional weekly hours', () => {
    const tasks = [{estimatedMinutes: 240}, {estimatedMinutes: 180}];
    expect(estimateWork(tasks, 2)).toEqual({minutes:420, weeklyMinutes:120, minimumWeeks:4});
    expect(estimateWork(tasks, 3.5).minimumWeeks).toBe(2);
    expect(estimateWork([{estimatedMinutes: NaN}], 2).minutes).toBeNull();
  });

  it('surfaces arithmetic, long sessions, early checkpoints, and failure-as-delivery without rejecting the proposal', () => {
    const proposal = parseProposal({
      reasoning:'计划合计约6小时。',
      assumptions:[],
      warnings:[],
      stages:[{
        ref:'s', title:'可运行程序', milestone:'完成并验证程序', checkpointRef:'setup',
        tasks:[
          {ref:'setup', title:'安装软件', description:'', doneCriteria:'可运行脚本，或记录报错原因。', estimatedMinutes:60, difficulty:'standard'},
          {ref:'build', title:'实现并测试程序', description:'', doneCriteria:'样例测试全部通过。', estimatedMinutes:330, difficulty:'standard'},
          {ref:'diagnose', title:'诊断样例异常', description:'', doneCriteria:'若无法复现，记录原因和已核查的版本。', estimatedMinutes:30, difficulty:'light'},
        ],
      }],
    });
    expect(proposalReview(proposal,2).warnings).toEqual([
      expect.stringContaining('逐项相加为 420 分钟'),
      expect.stringContaining('检查点后还有 2 项任务'),
      expect.stringContaining('「安装软件」'),
      expect.stringContaining('预计 330 分钟'),
    ]);
    const replanWarnings=proposalReview(proposal,2,true).warnings;
    expect(replanWarnings).toHaveLength(2);
    expect(replanWarnings.join('')).not.toMatch(/诊断样例异常|逐项相加|检查点/);
  });
});
