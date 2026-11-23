import { DIRECTIONS } from "./catalog";
import type { CompletionEntry, Direction } from "./types";

/** Read-only projection. Creation never inserts completion entries or grants rewards. */
export function characterGrowth(characterId: string, entries: CompletionEntry[]) {
  const abilities = Object.fromEntries(DIRECTIONS.map(d => [d.id, 0])) as Record<Direction, number>;
  let totalXp = 0;
  for (const entry of entries) if (entry.characterId === characterId) {
    totalXp += entry.xp; abilities[entry.direction] += entry.xp;
  }
  return { totalXp, level: 1 + Math.floor(totalXp / 100), levelProgress: totalXp % 100, abilities };
}
