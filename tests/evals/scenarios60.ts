import data from './scenarios60.v2.json';
import type {EvalCase} from './cases';
export const SCENARIOS60_VERSION=data.datasetVersion;
export const SCENARIOS60_PROVENANCE=data.provenance;
export const SCENARIOS60_CASES=data.cases as (EvalCase&{scenario:string;level:string;horizon:string})[];
export const SCENARIOS60_SLOTS=SCENARIOS60_CASES.map(c=>({slotId:c.id,caseId:c.id,round:1}));
