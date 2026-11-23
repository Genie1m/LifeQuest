"use client";

import Image from "next/image";
import { useState } from "react";
import { characterVocation } from "@/domain/catalog";
import { CHARACTER_ASSETS, type CharacterAsset } from "@/lib/character-assets";
import { Button } from "../ui/button";

type Kind = "full" | "portrait";

function ArtImage({ asset, name, kind, eager }: { asset: CharacterAsset; name: string; kind: Kind; eager: boolean }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const image = kind === "full" ? asset.full : asset.portrait;
  const size = kind === "full" ? 480 : 128;
  const suffix = attempt ? `?retry=${attempt}` : "";
  const label = `${name}${kind === "full" ? "基础人物立绘" : "头肩头像"}`;

  return <span className={`character-art art-${kind} art-${status}`}>
    {status !== "error" && <picture key={attempt}>
      <source type="image/webp" srcSet={`${image.small}${suffix} ${size}w, ${image.large}${suffix} ${kind === "full" ? 768 : 256}w`} sizes={kind === "full" ? "(max-width: 600px) 260px, 440px" : "(max-width: 600px) 76px, 100px"} />
      <Image unoptimized src={`${image.large}${suffix}`} width={image.width} height={image.height} alt={label} loading={eager ? "eager" : "lazy"} onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />
    </picture>}
    {status === "loading" && <span className="art-loading" role="status">正在载入人物…</span>}
    {status === "error" && <span className="art-error" role="status">
      <span>{kind === "full" ? `${name}插画暂时无法加载` : "头像加载失败"}</span>
      <Button type="button" variant="outline" onClick={() => { setAttempt(n => n + 1); setStatus("loading"); }}>重试图片</Button>
    </span>}
  </span>;
}

export function CharacterArtwork({ avatarId, kind = "full", eager = false }: { avatarId: string; kind?: Kind; eager?: boolean }) {
  const vocation = characterVocation(avatarId);
  if (!vocation) return <span className={`legacy-art legacy-${kind}`} role="img" aria-label="旧版角色形象，职业尚未确认"><span>旧版</span>{kind === "full" && <span>原有角色已保留<br />职业尚未确认</span>}</span>;
  const asset = CHARACTER_ASSETS[vocation.id];
  return <ArtImage key={`${vocation.id}:${kind}`} asset={asset} name={vocation.name} kind={kind} eager={eager} />;
}
