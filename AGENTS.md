# LifeQuest 开发约束

- 开发前完整阅读 `docs/PRD.md`、`docs/ARCHITECTURE.md`、`docs/ROADMAP.md`，检查 Git 状态、现有提交和当前阶段。
- 只修改 LifeQuest 项目；保持既有领域规则与分层架构，一次只实现用户指定阶段。未经要求，不提前开发后续业务。
- 本地身份与云端认证分开，浏览器存储仅在客户端访问。损坏、无效、不支持的数据不得自动清空或覆盖。
- 每个独立模块完成适用测试与检查后创建清晰的本地 commit；阶段结束更新文档、报告检查结果和限制，并停止等待验收。
- `main` 保存已验收版本，`dev` 保存本地开发。保留历史，不强制改写，不修改无关 Git 配置。
- 提交前检查 status、diff 和敏感信息；只按明确路径暂存，禁止 `git add .` 和 `git add -A`。不提交依赖目录、构建产物或环境秘密。
- 未经用户针对版本的明确批准，绝不 push、创建远程分支、创建 PR 或合并远程分支。创建仓库也需要单独授权。
- 批准发布后，只将批准的提交安全快进/合并到 main；首次推送复核远程归属与目标分支。远程有新提交先 fetch 检查，冲突停止报告，禁止 force push。
- 不要求用户在聊天中提供 Token、密码或私钥；使用官方交互式认证。不自动安装 Supabase、LLM SDK 或复杂状态框架。

当前授权阶段：Step 2.5（Arcane Indigo 设计系统优化、依赖审计、Turbopack 核实与 GitHub 准备）。仅在 dev 增量修改；不得开始 Step 3、改 XP 规则、接入 AI、开发 Mock Planner，或新增 Agent/RAG 框架。本轮不得创建仓库、改变可见性、修改远程设置、合并到 main、push 或创建 PR；远程只读核对，认证由用户通过官方流程完成。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
