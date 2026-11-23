import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const PLANNER_SOURCE_PATHS = [
  'src/services/planner/instructions.ts', 'src/services/planner/versions.ts',
  'src/services/planner/server.ts', 'src/services/planner/compatible.ts',
  'src/services/planner/proposal-output.ts', 'src/services/planner/connection.ts',
  'src/services/planner/types.ts', 'src/app/api/planner/route.ts',
  'src/services/planner/local-request.ts', 'src/services/planner/catalog.ts',
  'src/services/planner/mock.ts', 'scripts/eval60.mjs', 'scripts/retry-evals.mjs',
  'scripts/freeze-planner.mjs', 'scripts/review-saved-evals.mjs',
  'src/domain/proposal.ts', 'src/domain/plan-quality.ts', 'src/domain/plan-estimates.ts',
  'src/domain/plan-readiness.ts', 'src/domain/commands.ts', 'src/domain/validation.ts',
  'src/domain/types.ts', 'tests/evals/evaluation.ts', 'tests/evals/batch.ts',
  'tests/evals/planner-fingerprint.ts', 'tests/evals/scenarios60.ts',
  'tests/evals/scenarios60.v2.json', 'docs/AI_EVALUATION.md',
] as const;

export async function plannerFingerprint() {
  return Object.fromEntries(await Promise.all(PLANNER_SOURCE_PATHS.map(async file =>
    [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
}
export async function assertPlannerFingerprint(expected: Record<string,string>) {
  if(Object.keys(expected).length!==PLANNER_SOURCE_PATHS.length||PLANNER_SOURCE_PATHS.some(file=>!Object.hasOwn(expected,file)))throw new Error('Planner fingerprint paths differ');
  const actual=await plannerFingerprint();
  if(PLANNER_SOURCE_PATHS.some(file=>actual[file]!==expected[file]))throw new Error('Planner files changed after freeze; start a separate run');
}
