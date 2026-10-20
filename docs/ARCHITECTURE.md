# LifeQuest 技术架构

版本：0.3 · 日期：2026-10-20 · 状态：Step 2.5 设计与工程复核完成，待验收

需求依据：[PRD.md](PRD.md)。开发顺序：[ROADMAP.md](ROADMAP.md)。Step 1 为规划；Step 2 已初始化应用与本地状态基础，未实现后续业务命令、AI 或数据库。

## 1. 技术决策

| 领域 | 第一阶段选择 | 原因/限制 |
| --- | --- | --- |
| Web 框架 | Next.js App Router + TypeScript | 路由清晰，后续可增加服务端接口 |
| 界面 | Tailwind CSS + 按需使用 shadcn/ui | 一套表单、对话框与导航组件，避免另建组件体系 |
| 状态 | React Context + 少量 hooks，领域逻辑为纯函数 | 本地单用户规模，无需 Redux/Zustand 或服务端缓存库 |
| 持久化 | localStorage 单个版本化 JSON 快照 | 简单可验证；只支持单浏览器、小数据量 |
| 规划器 | 异步 Planner 接口 + 确定性 Mock 实现 | UI 不依赖生成方式，后续替换 LLM 适配器 |
| 测试 | Vitest + jsdom + Testing Library | Step 2 验证快照与 Provider；XP 等到对应阶段再测 |
| 后续能力 | Supabase Auth/数据库、服务端 LLM | 独立后续阶段；不提前实现接口路由和鉴权 |

已按官方安装说明手工初始化，保留原目录和历史，版本由 package-lock 固定。Next.js 16.4.2、React 19.3.1、TypeScript 6.0.3、Tailwind 4.3.3；后续升级仍需核对官方兼容说明。

## 2. 最小分层与目录建议

```text
src/
  app/                       # 路由、布局；浏览器状态交互放 client 边界
  components/                # 公共 UI、表单、成长反馈
  features/
    character/               # 角色展示与创建
    goals/                   # 目标、阶段、计划编辑与执行
    planner/                 # 建议请求状态、对照与接受/拒绝
  domain/
    types.ts                 # 数据类型与存储 schema
    rules.ts                 # 校验、状态转换、完成与确认命令
    progression.ts           # XP、等级、成就的派生计算
  services/
    planner.ts               # 接口与 Mock 实现
    repository.ts            # 异步存取接口、localStorage 实现及迁移
  state/
    AppProvider.tsx          # 加载、草稿防抖保存、领域命令、错误状态
```

依赖方向：路由/组件 → feature/hooks → 领域命令 → Repository/Planner 端口。领域规则不导入 React、localStorage 或远程 SDK。不引入微服务、事件总线、通用工作流引擎、复杂依赖注入或多 Agent。

静态页面壳可使用 Server Components；访问 localStorage 的 Provider 与交互组件必须是 Client Components。首屏显示加载状态，挂载并读取数据后再决定引导或目标路由，避免 SSR 访问浏览器 API 和 hydration 不一致。

## 3. 数据模型

以下模型已在 `src/domain/types.ts` 建立，快照校验在 `src/domain/validation.ts`。ID 使用 UUID，时间使用 ISO 字符串，顺序使用数组位置，不另存容易冲突的 order 字段。

| 实体 | 核心字段 | 关系与约束 |
| --- | --- | --- |
| LocalProfile | id, createdAt | 当前浏览器一个；不是登录账号或安全凭证 |
| Character | id, profileId, name, avatarId, createdAt | 一个 profile 一个角色；经验由流水派生 |
| Goal | id, characterId, title, successCriteria, direction, baseline, weeklyHours, status, createdAt, completedAt? | status 为 draft/active/completed |
| PlanContent | stages: Stage[] | 嵌入 Goal；阶段内嵌任务，避免额外通用 CRUD 层 |
| Stage | id, title, milestone, tasks: Task[] | 阶段完成状态由任务派生 |
| Task | id, title, description, doneCriteria, estimatedMinutes, difficulty, status, completedAt? | status 为 pending/completed |
| ExecutionPlan | revision, content: PlanContent, confirmedAt | Goal 的 confirmedPlan；首次确认前不存在 |
| PlanDraft | baseRevision, content: PlanContent, source, proposedWeeklyHours?, adjustmentFeedback?, updatedAt | Goal 的 draft；source 为 manual/mock；首次 baseRevision=0；可选字段记录本次调整输入 |
| CompletionEntry | taskId, goalId, stageId, characterId, direction, xp, difficulty, taskTitle, stageTitle, completedAt, note? | taskId 全局唯一；记录完成时快照 |
| AppSnapshot | schemaVersion, revision, profile?, character?, goals[], completions[] | localStorage 的唯一业务快照 |

`direction = knowledge / vitality / creativity / action / social`，界面显示学识/体能/创造/行动/社交。`difficulty = light / standard / challenge`，对应 20/40/60 XP。校验上限与必填字段按 PRD 执行，运行时同样校验读取数据及规划器结果，TypeScript 类型不能替代运行时检查。

不单独持久化 totalXp、level、阶段进度、能力经验、成就解锁状态等可派生数据，防止状态漂移。成就解锁时间从符合条件的完成记录及 completedAt 推导；重载时不重复播放动画，动画由本次成功命令的结果触发。总经验以 CompletionEntry 为准，任务状态与流水不一致视为数据异常。

角色未创建时允许 profile/character 为空；角色创建命令一次性生成两者。Goal 的生成参数可随目标草稿保存，但正式目标元信息在首次确认后按 PRD 锁定；调整用 proposedWeeklyHours 与 adjustmentFeedback 随 PlanDraft 保存，确认时才更新 Goal.weeklyHours，拒绝不改变正式值。建议尚未接受时，其输入与结果留在临时审阅状态，不改已有草稿。

## 4. 状态与计划编辑

```text
无角色 → 创建角色 → 无目标
无目标 → 创建 Goal(draft) + PlanDraft
draft → 校验/预览/确认 → active + ExecutionPlan(revision=1)，清除 draft
active → 开始修改 → 保留 ExecutionPlan + 新 PlanDraft(baseRevision=N)
active + draft → 放弃修改 → 清除 draft，继续原计划
active + draft → 校验/预览/确认 → 替换计划，revision=N+1，清除 draft
active → 最后一项完成 → completed（只读），允许新建目标
```

- 生成和手工编辑共享 PlanDraft。阶段和任务 ID 不因保存或确认而改变；新增才分配新 ID。
- 草稿自动保存采用短防抖；进入预览、确认、离开编辑器时主动 flush。存在未保存输入时阻止内部导航并提示；刷新/关闭使用浏览器离开提示，异常退出可能损失最近一段未保存输入。
- 开始修改已有计划时复制其内容，记录 baseRevision；存在草稿时禁止任务完成命令，用户先确认或明确放弃修改。
- 确认需同时检查：草稿结构有效、baseRevision 与正式计划一致、已完成任务的 ID/字段/归属不变，其所属阶段的 ID/名称/里程碑不变且不允许主动移动；该阶段内尚未完成的任务仍可编辑。已全部完成的阶段不可再追加任务。确认失败保留草稿与正式计划。
- 手动删除阶段时，若包含任务先确认；包含已完成任务则禁止删除。编辑按钮置灰之外仍要在领域层检查。
- 首次确认不结算 XP；执行中修改不修改已有 CompletionEntry。完成目标后不可重开编辑。
- revision 只保存当前正式版本和待确认草稿，不保留全量版本历史。目标已完成任务仍留在当前计划，用于查看与追溯。

## 5. 任务完成与结算

以 `completeTask(goalId, taskId, note?)` 作为唯一结算入口，所有 UI 都调用同一命令。

1. 检查存储可用且快照未过期；目标 active、有正式计划、没有待确认编辑草稿。
2. 定位任务；若已有相同 taskId 流水，返回 alreadyCompleted，不再次追加记录或播放奖励。
3. 校验任务 pending、参数有效，按正式计划的难度算 XP，取目标成长方向。
4. 在内存副本中同时标记 completed、创建 CompletionEntry；如全部任务已完成则标记 Goal completed。
5. Repository 一次写入完整新快照，成功后替换 UI state；失败时不提交内存状态，保留用户备注以便重试。
6. 比较前后派生值，返回本次 XP、升级跨度、新成就与阶段/目标完成反馈。不能依赖动画回调写业务状态。

公式：`totalXp = sum(completions.xp)`；`level = 1 + floor(totalXp / 100)`；`levelProgress = totalXp % 100`。某方向经验为该方向流水 XP 之和，五方向之和必须等于总 XP。

阶段进度 = 已完成任务数/该阶段任务总数；目标进度 = 全部已完成任务数/当前计划任务总数。确认新增任务后进度比例可能下降，需解释“任务范围已更新”，已有 XP 不下降。奖励不随单纯编辑或调整触发。

## 6. Planner 接口与 Mock

```typescript
interface Planner {
  generate(input: GoalPlanningInput): Promise<PlanSuggestion>;
  adjust(input: AdjustmentInput): Promise<PlanSuggestion>;
}
// GoalPlanningInput：目标元信息、基础、每周投入。
// AdjustmentInput：正式计划、完成流水摘要、执行感受、新投入。
// PlanSuggestion：说明、建议 PlanContent、简短变更摘要。
```

- Mock 根据成长方向和输入选择固定模板，默认三阶段、每阶段三任务；模板产出明确完成标准并说明如何推进用户目标。没有足够语义理解时明确提醒用户改写，不能伪称真实个性化推理。
- 以确定性规则处理每周投入变化，支持一个简单的可执行调整例子。保留已完成任务 ID 和内容，仅对未完成任务提出修改；校验失败的结果不能进入正式计划。
- Planner 返回候选内容；领域层为新增实体分配 ID，使用旧 ID 校验被保留的实体，组件不能相信规划器输出的身份或完成状态。
- 生成时禁用重复请求；请求期间锁定对应输入，离开/重新请求时忽略过期结果。结果先显示建议，用户接受后才写入草稿，仍需最终确认。
- 生成失败显示错误与重试/手动创建，保留原计划。测试中通过注入失败 Planner 检查异常，不在产品 UI 暴露调试开关。
- 未来真实实现改为调用自有服务端接口，在服务端保存 LLM 密钥、执行结构化输出校验和错误处理。不得把密钥放入 `NEXT_PUBLIC_*` 或浏览器请求参数。
- 后续需要单独设计鉴权、配额、超时、隐私授权、提示词和输出质量验证；替换 Planner 不意味着真实 AI 已具备生产可用性。

## 7. 本地存储与错误恢复

提供窄接口 `load(): Promise<AppSnapshot | null>`、`save(next, expectedRevision): Promise<void>`。Promise 让 UI 无需假设存储同步，但不试图把整个本地快照直接映射为远程数据库接口。

- Key：`lifequest:state`；初始 schemaVersion=1，revision 为每次成功保存递增的全局整数。
- 无数据时进入初始流程；先区分 JSON 解析错误、不支持的版本、结构无效、存储被禁用、空间不足。
- 保存采用一次 `setItem` 写完整快照，避免任务和 XP 分开写入；此原子性仅针对单 key 写入，不是跨标签页数据库事务。
- 读取/迁移失败保留原始 key，不写默认空数据；显示无法加载并提示保留站点数据。存储失败不显示已保存，允许重试；不自动清除损坏记录。
- 使用显式 `migrateSnapshot` 处理已支持的旧版本，迁移校验成功且保存成功后才启用；遇到未来版本阻止写入。v1 不虚构不存在的旧版本迁移。
- 支持的单标签页流程通过写入队列串行化草稿保存与完成命令，避免防抖草稿覆盖刚完成的事务。
- 每次写前读取 revision 并与 expectedRevision 比较；监听 `storage` 事件，发现外部变化冻结编辑并提示重新加载。比较与写入不构成真正原子锁，首版不承诺同时多标签写入安全；验收需验证检测到冲突后不会继续覆盖。
- 数据加载失败与真正“首次使用”是两种状态；不要在无法读取时把用户导航到建角流程并覆盖数据。

## 8. 未来 Supabase 迁移路径

本轮仅约定边界，不创建 Supabase 项目/表、不安装 SDK。

1. 引入真实 Auth，把远程 `auth.users.id` 作为所有权依据；本地 profileId 不能作为可信身份。
2. 建立 profiles/characters/goals/stages/tasks/task_completions 表，保留 UUID；行记录 owner_id，以 RLS 约束读写。正式计划与编辑草稿分开持久化，实际 SQL 结构到该阶段再确定。
3. 将本地“确认计划”和“任务完成”改为服务端事务命令；完成任务和插入流水同一事务，task_id 唯一约束，服务端按任务版本算 XP，客户端不提交可信奖励值。
4. 前端继续复用领域类型、校验、派生计算和 Planner，换成远程读取与命令适配器；不以整份快照覆盖所有远程数据，不承诺只替换一个文件即可完成同步。
5. 登录后由用户明确选择导入本地数据；校验 schema、引用与流水，使用导入批次及稳定 ID 防重复。云端已有数据时先设计冲突预览，不静默合并或覆盖。
6. 导入验收通过前保留本地副本；再单独设计断网、并发和多端同步。不得把第一阶段单标签页约定扩展为生产级一致性保证。

## 9. 基础检查与测试重点

| 层面 | 必须覆盖 |
| --- | --- |
| 领域规则 | 非法状态不能确认/完成；完成实体不可编辑；一个非完成目标限制 |
| XP | 20/40/60、跨级、能力和总经验一致、重复结算不增加流水 |
| 草稿 | 初次确认、重新确认、拒绝/放弃、ID 保持、锁定完成历史、过期建议 |
| 持久化 | 刷新恢复、写入失败不提交、损坏不清空、版本拒绝、外部 revision 冲突 |
| 用户路径 | 建角到完成目标；空状态、错误状态；键盘和移动布局 |

后续代码模块按风险选择单元测试/集成测试与端到端检查；不为静态文案或简单视觉变动机械增加测试。每步的具体验收见路线图。

## 10. Step 2 实际落地与范围说明

- Repository 仍按约定使用 `load()` 与 `save(next, expectedRevision)`；无数据返回 null。Provider 在内存创建空快照，不自动覆盖存储。save 更新入口接受 updater，内部串行化、校验版本，成功后才发布状态。
- 错误区分 invalid-json、invalid-data、unsupported-version、unavailable、write-failed、conflict；读取失败不进入业务默认状态，写失败不发布新快照。storage 事件与 revision 检查阻断已检测到的旧页写入。
- 无第三方 schema 库：当前使用小型手写运行时校验，覆盖模型字段、标识/时间、引用、状态和流水一致性。草稿内容允许未填写，正式计划字段更严格，避免自动保存草稿被激活校验拦住。
- `features/`、rules/progression、Planner 及业务命令尚未创建，等对应阶段再引入。Provider 不承担角色创建、任务完成或 XP 结算逻辑。
- 基础 Button 采用 shadcn/ui 的 Slot/CVA 组合，Card 为项目可编辑源码，components.json 与 Tailwind tokens 已配置；视觉规范见 [DESIGN.md](DESIGN.md)。未引入复杂状态库、表单库或动画库。
- Step 2 曾因 Turbopack CSS 子进程连接失败采用 Webpack。Step 2.5 直接 Turbopack 生产构建已成功，旧错误未复现，根因仍未确认；默认脚本继续保留已验证的 Webpack。完整环境记录见 [ENGINEERING_HEALTH.md](ENGINEERING_HEALTH.md)。
- 首屏只展示无业务数据的骨架，加载/错误状态可见；自动建角路由守卫到 Step 3 再实现。本轮不把页面能访问视为业务功能完成。
- 浏览器测试使用预装 Playwright 驱动独立 Chrome 无头进程，不依赖已登录个人浏览器；本机 Edge/Chrome 的交互控制连接不可用。临时截图与验收脚本保存在忽略的 `.qa/`，不提交个人环境路径。
- 本轮 PRD 规则未改动；本轮没有 Supabase、LLM SDK 或任何远程数据写入业务实现。

## 11. Step 2.5 视觉与 AI 扩展边界

视觉 token 升级为 Arcane Indigo，采用统一运行时字体与语义色，导航和路由保持原逻辑；不修改领域、Repository、Provider、存储 key/schema 或 XP 规则。新增反馈测试覆盖读取错误与初始化期间的跨标签冲突，修正加载状态可能遮住错误提示的问题。设计见 [DESIGN.md](DESIGN.md)。

现有 Planner.generate/adjust 及草稿隔离可支持以下方向，无需提前引入新框架：

| 后续方向 | 约定的扩展边界 |
| --- | --- |
| 个性化成长规划 | 使用目标成功标准、当前基础与投入作为输入，输出可编辑建议，不创建正式执行状态 |
| 可执行性与合理性检查 | 先做确定性字段/数量/时间校验；后续 AI 语义检查作为原因和风险提示，不替用户确认，不伪称客观保证 |
| 动态调整 | 以当前 revision 与完成记录摘要为上下文，建议仅修改未完成部分；应用时再次验证版本与完成历史 |
| 人工审核 | 用户可以编辑、拒绝或接受到草稿，再明确确认；AI 不直接调用 Repository 写正式计划 |
| 可选成果反馈 | 后续独立阶段设计，用户选择提交最少必要内容；反馈作为附加说明，不成为当前 XP 的输入或改写既有结算 |

AI 只提建议，用户审核确认，程序负责正式状态与奖励结算。未来引入真实模型时再增加服务端密钥、输入隐私、结构化输出及超时/失败处理；本轮不实现 Mock Planner、LLM、Agent/RAG 或 AI 成果评价，也不把这些扩展加入 Step 3。
