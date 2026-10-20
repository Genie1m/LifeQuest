# LifeQuest 设计系统：Arcane Indigo

Step 2.5 · 2026-10-20。视觉方向：Modern AI × Fantasy RPG。实现基准为 `src/app/globals.css`；本轮只优化基础导航、组件和占位页面，不代表业务功能已开放。

## 1. 旧设计到新设计

| Step 2 | Step 2.5 |
| --- | --- |
| 墨绿背景、暖金主按钮，偏传统奇幻 | 深蓝背景、靛紫主交互，保留轻量冒险氛围 |
| 大型罗盘、衬线展示标题 | 简洁路径插画、系统无衬线标题；图形为装饰，无虚构成长数据 |
| 大量 7–11px 标签、正文 12px | 正文 14–16px，所有说明/辅助标签至少 12px |
| 颜色直接散落在各组件样式 | 语义 token 分别管理背景、层次、操作、反馈与奖励 |
| 金色普遍用于动作与装饰 | 金色仅预留 XP/等级/成就语义，本轮不渲染假奖励 |

修正字体 token 的运行时定义：`--font-body` 放在 :root，body 直接引用；Tailwind `--font-sans` 映射到同一值，避免仅在 inline theme 定义导致普通 CSS 回退字体。浏览器实际 computed font-family 已检查为系统无衬线。

## 2. 语义色彩

| 语义 | CSS token | 色值 | 使用边界 |
| --- | --- | --- | --- |
| Background | --background | #101426 | 页面底色 |
| Surface | --surface / --card | #1C2440 | 内容卡片、主视觉、加载反馈 |
| Surface Elevated | --surface-elevated / --muted | #242F4D | 图标容器、悬停、禁用控件底色 |
| Navigation | --surface-navigation | #141A30 | 侧栏、底栏、顶级辅助区域 |
| Selected | --surface-selected | #2B2E65 | 导航选中底色；辅以指示条和加粗，不只依靠颜色 |
| Primary | --primary | #625DEB | 主按钮与关键动作；从参考 #6366F1 微调以提高白字对比度 |
| Primary Hover | --primary-hover | #534DCF | 按钮/按钮链接悬停 |
| Primary Foreground | --primary-foreground | #FFFFFF | 主按钮文字 |
| Secondary | --secondary / --accent | #BBA6FF | 次级强调、导航图标、轻量路径图；比参考辅助紫更易读 |
| Border | --border | #344260 | 非关键内容分组边框，不能单独作为关键控件边界 |
| Control Border | --border-control | #7383AF | 描边按钮等关键边界，和 elevated surface 对比度超过 3:1 |
| Primary Border | --primary-border | #BBA6FF | 主按钮轮廓，避免仅靠深色填充区分边界 |
| Text Primary | --text-primary / --foreground | #F5F7FF | 标题和主要信息 |
| Text Secondary | --text-secondary / --muted-foreground | #AAB5D1 | 正文说明、状态文案、标签 |
| Success | --success | #65D6AB | 本地就绪状态，搭配文字；不是 XP 色 |
| Success Surface | --success-surface | #17372F | 预留成功反馈背景，尚未新增业务提示 |
| Warning | --warning | #FFB174 | 预留警告；搭配文字/图标，区别于奖励 |
| Warning Surface | --warning-surface | #392A23 | 预留警告背景 |
| Danger | --danger | #FF9CB0 | 错误图标、标题、说明 |
| Danger Surface / Border | --danger-surface / --danger-border | #342136 / #DC7C95 | 错误容器背景与轮廓 |
| XP / Reward | --reward | #F1C978 | 只预留给后续经验、等级、成就；本轮不用于主按钮 |
| Focus Ring | --focus-ring | #C4B5FD | 3px 实线 + 4px 偏移；与深色背景之间留出间隔 |

Tailwind 通过 `@theme inline` 映射对应语义色，组件使用 token utility。主体卡片为实色，主视觉仅有低不透明度局部光晕；没有大面积饱和渐变、玻璃卡片或外部图片/字体依赖。

## 3. 字体、尺寸与布局

- 字体：Segoe UI → Microsoft YaHei UI → Microsoft YaHei → PingFang SC → sans-serif；中英文使用同一系统字体栈，标题采用 600–650 字重。
- 默认正文 15px；卡片正文和移动说明 14px；辅助信息至少 12px；区块标题 21–23px；页面标题 28–38px；首页标题 30–48px。未开放功能的阶段标签仍清楚可读。
- 4px 间距基数，常用 8/12/16/20/24/32/44/48px；按钮圆角 10px、卡片 16px、主视觉 20px。`--radius-control`、`--radius-card` 供基础组件复用。
- 内容最大 1320px；侧栏默认 248px，1100px 以下 220px，850px 以下 190px；850px 以下卡片一列。
- 600px 以下采用底栏，高度 80px + safe-area；内容额外预留底部空间和根级 scroll-padding，防止末尾内容或聚焦链接被底栏永久遮挡。
- 390px 主区域左右 20px，320px 收紧到 16px；移动端顶栏保留产品名，三入口和既有路由逻辑不变。

## 4. 组件与反馈

- 主按钮：靛紫底、白字、浅紫边界；Hover 加深，键盘 Focus 使用独立浅紫 ring；Disabled 使用 elevated surface 和明确禁用语义，不简单降低整组件透明度。
- 次按钮：高对比边界；文字链接附方向图标，Hover 下划线；主要交互至少 44px 高。
- 当前导航同时使用 aria-current、色块、指示条和字重。金色不参与导航选中。
- Loading 使用 role=status 与动效图标；prefers-reduced-motion 时关闭非必要动画/过渡。
- Empty 保留未实现说明、后续阶段与返回入口，不展示假任务或数据。
- Error 使用独立粉红语义色、警示图标、role=alert 和重新读取操作。即使初始化 loading 时出现跨标签冲突，也优先显示错误。

## 5. 对比度与验收范围

按 sRGB 相对亮度公式计算，并从 Chrome 实际 token/样式读取结果：

| 前景 / 背景 | 对比度 |
| --- | --- |
| 主要文字 / 页面背景 | 17.07:1 |
| 次要文字 / Surface | 7.44:1 |
| 白字 / Primary | 4.90:1 |
| 白字 / Primary Hover | 6.31:1 |
| Secondary / Surface | 7.28:1 |
| Control Border / Elevated Surface | 3.52:1 |
| Focus Ring / 页面背景 | 9.89:1 |
| Danger / Danger Surface | 7.51:1 |
| Danger Border / Danger Surface | 5.19:1 |

普通文字按至少 4.5:1，关键非文本轮廓按至少 3:1 检查；分组装饰边框不承担唯一识别作用。标准依据：[WCAG 2.2 文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[非文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)。

本轮检查覆盖 1440px、390px、320px，7 个路由、文字字号、横向溢出、Hover/Focus/Disabled、错误数据保留、减少动态效果与移动底栏末尾净空。独立 Chrome 上下文生成 `.qa/step25-1440.png`、`.qa/step25-390.png`、`.qa/step25-320.png`、空状态与错误截图；本地验收产物不纳入源码提交。

截图由开发侧检查，用户视觉验收仍待完成。不是完整 WCAG 合规认证；未验证屏幕阅读器、真机、Safari 或所有未来业务组件。
