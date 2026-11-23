import {parseProposal,ProposalValidationError} from '@/domain/proposal';
import {PlannerError} from './types';

/** Only validator-owned paths/rules can leave the server, never model content. */
export function parseModelProposal(raw:unknown){
 try{return parseProposal(raw);}
 catch(e){
  if(e instanceof ProposalValidationError)throw new PlannerError('invalid-response',e.message,undefined,e.issue);
  throw new PlannerError('invalid-response','候选计划校验失败，未导入；原草稿未改变。');
 }
}
