import type { AvatarId } from "@/domain/catalog";
import manifest from "../../public/characters/manifest.json";

export interface CharacterAsset {
  version: string;
  full: { small: string; large: string; width: number; height: number };
  portrait: { small: string; large: string; width: number; height: number };
}

// Only reviewed production art belongs here. No generated paths or Base64 in snapshots.
export const CHARACTER_ASSETS: Record<AvatarId, CharacterAsset> = manifest.characters;
