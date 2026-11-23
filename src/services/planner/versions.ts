import {PLANNER_PROMPT_VERSION, PROPOSAL_WIRE_SCHEMA_VERSION} from './instructions';
import {PLAN_REVIEW_VERSION} from '@/domain/plan-quality';

export const PLANNER_VERSIONS = {
  prompt: PLANNER_PROMPT_VERSION,
  schema: PROPOSAL_WIRE_SCHEMA_VERSION,
  review: PLAN_REVIEW_VERSION,
} as const;
