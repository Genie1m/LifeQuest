// Deterministic export of approved art: crop framing, resize and WebP encode only.
// No painting, background synthesis or generated art enters this script.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const cast = "assets/characters/source/approved-cast.png";
const configs = [
  { id: "mage", key: "scholar-mage", source: cast, full: { left: 37, top: 19, width: 572, height: 849 }, portrait: { left: 235, top: 10, width: 300, height: 300 } },
  { id: "ranger", key: "pathfinder", source: cast, full: { left: 625, top: 10, width: 587, height: 856 }, portrait: { left: 770, top: 5, width: 320, height: 320 } },
  { id: "artisan", key: "artificer", source: "assets/characters/source/artificer-a.png", portrait: { left: 400, top: 0, width: 420, height: 420 } },
];
const manifest = {
  source: "Built-in image_gen, based on the user-approved LifeQuest cast",
  approval: "2026-10-20: user approved style and main designs; retain identity and simplify small details",
  version: "step-3.6-a-v1",
  characters: {},
};
for (const config of configs) {
  const input = await readFile(path.join(root, config.source));
  const directory = `characters/${config.key}/a-v1`;
  await mkdir(path.join(root, "public", directory), { recursive: true });
  const fullPipeline = sharp(input);
  if (config.full) fullPipeline.extract(config.full);
  else fullPipeline.trim({ background: "#00000000", threshold: 10 });
  const full = await fullPipeline.resize(676, 844, { fit: "contain", background: "#00000000" })
    .extend({ top: 58, bottom: 58, left: 46, right: 46, background: "#00000000" }).png().toBuffer();
  const portrait = await sharp(input).extract(config.portrait).resize(256, 256).png().toBuffer();
  const saved = {};
  for (const [kind, buffer, sizes] of [["full", full, [[480, 600], [768, 960]]], ["portrait", portrait, [[128, 128], [256, 256]]]]) {
    const outputs = [];
    for (const [width, height] of sizes) {
      const bytes = await sharp(buffer).resize(width, height).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toBuffer();
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
      const relative = `${directory}/${kind}-${width}-${hash}.webp`;
      await writeFile(path.join(root, "public", relative), bytes);
      outputs.push(`/${relative}`);
    }
    const [width, height] = sizes.at(-1);
    saved[kind] = { small: outputs[0], large: outputs[1], width, height };
  }
  manifest.characters[config.id] = {
    version: "a-v1", ...saved,
    provenance: { source: config.source, sha256: createHash("sha256").update(input).digest("hex"), fullCrop: config.full ?? "transparent bounds", portraitCrop: config.portrait },
  };
}
await writeFile(path.join(root, "public/characters/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("Exported 3 approved characters, 12 transparent WebP variants and manifest.");
