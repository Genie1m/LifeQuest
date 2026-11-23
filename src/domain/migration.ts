import type { AppSnapshot } from "./types";
import { parseSnapshot } from "./validation";
import { parseSnapshotV1 } from "./legacy/validation-v1";
import { classFields } from "./commands";

/** Deterministic upgrade: no clock, UUID, reward or storage side effects. */
export function migrateV1(value: unknown): AppSnapshot {
  const previous = structuredClone(parseSnapshotV1(value));
  const next: AppSnapshot = { ...previous, schemaVersion: 2, revision: previous.revision + 1 };
  // v1 permits unknown extra fields; never trust them as new version semantics.
  delete next.focusGoalId;
  if (next.character) {
    delete next.character.classId; delete next.character.appearanceId;
    Object.assign(next.character, classFields(next.character.avatarId));
  }
  const active = next.goals.find(g => g.status === "active");
  if (active) next.focusGoalId = active.id;
  return parseSnapshot(next);
}
