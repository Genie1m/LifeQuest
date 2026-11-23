import type { PlanProposal, PlanningInput, ProposalIssue } from "@/domain/proposal";
export type PlannerErrorCode = "authentication"|"model-access"|"quota"|"rate-limit"|"network"|"timeout"|"server"|"invalid-response"|"disabled"|"cancelled"|"invalid-request";
export class PlannerError extends Error { constructor(public readonly code: PlannerErrorCode,message:string,public readonly upstreamStatus?:number,public readonly validationIssue?:ProposalIssue){super(message);this.name="PlannerError";} }
export interface PlannerResult { proposal: PlanProposal; elapsedMs:number; usage?:{inputTokens:number;outputTokens:number;totalTokens:number}; source:"openai"|"mock"|"qwen"|"compatible" }
export interface RealityPlanner { generate(input:PlanningInput,signal?:AbortSignal):Promise<PlannerResult>; test(signal?:AbortSignal):Promise<{elapsedMs:number}> }
