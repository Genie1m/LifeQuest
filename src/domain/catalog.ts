import type { Direction } from "./types";

export const AVATARS = [
  {
    id: "mage", name: "知识法师", english: "Scholar Mage", artKey: "scholar-mage",
    personality: "沉静 · 好奇 · 热爱研究", description: "以好奇为光，让未知成为新的篇章。",
    quote: "每个未知，都藏着一页新故事。",
    background: "星藏图书馆的年轻探索者。相信每个问题都值得耐心追问，用书页与水晶记录旅途中闪现的理解。",
    props: "悬浮魔法书 · 知识水晶法杖", challenge: "知识试炼", collection: "知识卷轴 · 古代符文",
  },
  {
    id: "ranger", name: "探索游侠", english: "Pathfinder", artKey: "pathfinder",
    personality: "勇敢 · 灵活 · 乐于尝试", description: "以行动探路，在尝试中发现可能。",
    quote: "地图的尽头，是下一次发现。",
    background: "从远行营地出发的探路者。不必等到一切准备妥当，先走出一小步，再把发现留给未来的自己。",
    props: "探索地图 · 指南针 · 远行背包", challenge: "行动挑战", collection: "地图碎片 · 冒险日志",
  },
  {
    id: "artisan", name: "创造工匠", english: "Artificer", artKey: "artificer",
    personality: "务实 · 热情 · 喜欢创造", description: "让灵感落地，把想法打磨成作品。",
    quote: "让想法真正运转起来！",
    background: "晨光工坊里总有新点子的造物者。喜欢亲手验证、耐心打磨，相信每件值得分享的作品都始于一次小小尝试。",
    props: "护目镜 · 机械手套 · 设计蓝图", challenge: "成果锻造", collection: "设计蓝图 · 发明图鉴",
  },
] as const;

export type CharacterVocation = typeof AVATARS[number];
export type AvatarId = CharacterVocation["id"];
/** Display-only v1 bridge; unknown legacy IDs deliberately have no vocation. */
export function characterVocation(avatarId: string) {
  return AVATARS.find(vocation => vocation.id === avatarId);
}

export const DIRECTIONS: { id: Direction; name: string; english: string; description: string }[] = [
  { id: "knowledge", name: "学识", english: "Knowledge", description: "知识学习、语言与技能积累" },
  { id: "vitality", name: "体能", english: "Vitality", description: "运动实践与体能成长" },
  { id: "creativity", name: "创造", english: "Creativity", description: "创作、产品开发与项目实践" },
  { id: "action", name: "行动", english: "Action", description: "执行练习、习惯与行动力" },
  { id: "social", name: "社交", english: "Social", description: "表达、沟通与协作练习" },
];
