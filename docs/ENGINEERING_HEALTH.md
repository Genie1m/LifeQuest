# Step 2.5 工程健康与 GitHub 准备报告

检查日期：2026-10-20（Asia/Shanghai）。基线：dev / 35a0097。产品规则、领域模型、存储协议和 XP 规则保持不变。此报告区分依赖扫描、构建结果、可利用性判断与尚未验证的假设。

## 1. 环境与基线核对

| 项目 | 实际结果 |
| --- | --- |
| 项目目录 | D:\SCNU\aipm_project\lifequest，与其他项目隔离 |
| 初始工作区 | 干净 |
| Git | 2.35.1.windows.1；main=f327cfe，dev=35a0097 |
| Node/npm | Windows x64；D:\nvm\nodejs\node.exe；22.17.0 / 10.9.2 |
| 核心依赖 | Next 16.4.2、React 19.3.1、TypeScript 6.0.3、Tailwind 4.3.3 |
| 默认脚本 | dev/build 使用 --webpack，start 为 Next 生产服务 |
| 本轮依赖改动 | 无；package.json 和 package-lock.json 与 Step 2 一致 |
| 文档差异 | 旧文档将 Turbopack 记为失败；本轮直接构建成功，详见第 3 节 |

## 2. 依赖审计

### 实际执行

```powershell
npm audit --json --registry=https://registry.npmjs.org
npm audit --omit=dev --json --registry=https://registry.npmjs.org
npm ls braces micromatch fast-glob @next/eslint-plugin-next eslint-config-next
npm view braces version --registry=https://registry.npmjs.org
npm view micromatch version --registry=https://registry.npmjs.org
npm view fast-glob version --registry=https://registry.npmjs.org
npm view eslint-config-next version --registry=https://registry.npmjs.org
```

全量：5 项 High；生产（omit=dev）：0。5 项是同一根公告在依赖链的传播结果，不是 5 个独立 CVE。原始 JSON 保存在本地忽略的 `.qa/audit-step25-*.json`。

### 每项告警与依赖链

| 告警包 / 锁定版本 | 分类 | 引入路径 / 告警依据 | audit 受影响范围 |
| --- | --- | --- | --- |
| eslint-config-next 16.4.2 | dev 直接依赖 | 根开发依赖，受下游 plugin 影响 | >=14.3.0-canary.0 |
| @next/eslint-plugin-next 16.4.2 | dev 传递依赖 | eslint-config-next → plugin → fast-glob | >=14.3.0-canary.0 |
| fast-glob 3.3.1 | dev 传递依赖 | plugin 精确锁定 3.3.1 → micromatch | *，传播范围 |
| micromatch 4.0.8 | dev 传递依赖 | fast-glob → micromatch → braces | >=0.2.0，传播范围 |
| braces 3.0.3 | dev 传递依赖 | 递归解析深层花括号模式的根漏洞 | <=3.0.3 |

公告：[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。公告称深度嵌套的 brace 模式可能耗尽调用栈、导致 Node 进程终止；截至本轮复查，Patched versions 为 None。npm 输出使用 CVSS 3.1 7.5，公告页同时展示 CVSS 4.0 8.7，两者评分版本不同。

### 兼容修复判断与处理

- npm registry 当前发布：braces 3.0.3、micromatch 4.0.8、fast-glob 3.3.3、eslint-config-next 16.4.2。braces 最新仍受影响，未找到上游可靠修复版。
- Next ESLint plugin 对 fast-glob 精确依赖 3.3.1；即便单独替换成较新的 fast-glob，其下游 braces 公告也不会因此自动消失。未为无效消警添加 override。
- npm 建议把 eslint-config-next 降为 14.2.35，并标注 isSemVerMajor=true；该建议不是与 Next 16 已验证兼容的修复路径，未执行降级。
- 没有运行 npm audit fix --force，没有禁用规则、删掉检查或升级整个技术栈；保留已通过检查的版本。由于无可靠兼容修复，本轮没有安装/替换依赖，包清单与锁文件保持一致。

### 风险与边界

本项目在开发 Lint 工具链中携带受影响解析器，这是扫描确认的依赖风险。当前前端路由与业务接口没有接收用户提供的 glob 模式，也没有引入服务端 glob 服务；未证明网站存在从网络请求到该解析器的可利用路径。本轮未执行恶意模式 PoC，不能宣称已验证实际利用，也不能因生产 audit 为 0 宣称产品完全安全。

受影响模式若从不可信仓库或配置进入开发工具，仍可能造成工具进程拒绝服务。后续处理不可信项目配置前应重新评估。建议下次依赖升级或公开部署前复查该 GHSA 与 npm registry；若出现兼容修复，用小范围更新并重复 typecheck/lint/test/build。

## 3. Webpack / Turbopack 核实

### 历史证据

读取了 Step 2 保存的 panic log。错误链为 `globals.css → PostCssTransformedAsset → creating new process → node process exited before we could connect (exit code 0)`，子进程 stdout/stderr 均为空；历史构建在沙箱内外曾失败。该日志没有足够信息确认根因。

### 本轮复核

```powershell
node --version
npm --version
npm ls @next/swc-win32-x64-msvc @tailwindcss/oxide-win32-x64-msvc lightningcss-win32-x64-msvc
node node_modules/next/dist/bin/next build --turbopack
npm run build
```

- 直接 Turbopack 构建在沙箱外、Node 22.17.0 环境通过，退出码 0，所有既有路由生成成功；本轮没有复现旧的 CSS 子进程错误。该验证针对生产构建，未专门运行 Turbopack dev 长时间稳定性测试。
- 当前默认仍为 Webpack，未改变 bundler 脚本。Windows 原生 SWC 16.4.2、Tailwind oxide 4.3.3、Lightning CSS 原生组件均存在，不支持“必然缺少原生包”的推断。
- PostCSS 配置仍是标准 ESM 的 @tailwindcss/postcss 单插件；没有新增 Babel 配置或自定义 loader。NODE_OPTIONS 未设置；NODE_PATH 存在，但未确认其与历史失败有关。
- 查看了预装工具运行时 Node 24.19.0 的版本信息，但未用它替换项目 Node，也未据此推断需要升级。
- 最终 Webpack 构建与启动结果见本报告验收记录。中途沙箱构建曾出现 `.next/types` mkdir EPERM，不能与旧 Turbopack 错误混为一谈；通过停止本轮测试服务并在沙箱外重试核对。

结论：本轮 Turbopack build 成功，尚不能解释历史失败或保证所有环境稳定。无须为当前可用工程大改架构；保持 Webpack，若后续再现旧错误，另开环境诊断，保留日志与 Node 路径/版本/执行方式做对照。官方支持两种构建方式，参见 [Next.js Turbopack 说明](https://nextjs.org/docs/app/api-reference/turbopack)。

## 4. GitHub 认证与保护建议

### 实际状态

- git remote 确认 origin 为 https://github.com/Genie1m/LifeQuest.git。
- 只读连接器复核账号 Genie1m，仓库 owner=Genie1m、visibility=private、admin=true、size=0。与已授权 LifeQuest 仓库一致。
- gh --version / gh auth status 均无法运行，因为 gh 不在 PATH；两个常见 Windows 安装目录也未发现 gh.exe。不能把此状态称作 CLI 已认证。
- 本轮只读核对远程元数据，没有创建仓库/远程分支/PR、修改可见性或规则，没有 push，也没有合并到 main。账号套餐和已有保护规则细节未读取，不能确认私有仓库保护能力已启用。

### 用户在 Windows 完成官方认证

从 [GitHub CLI 官方项目安装说明](https://github.com/cli/cli#installation) 使用 WinGet，或从 [官网](https://cli.github.com/) 下载官方 MSI：

```powershell
winget install --id GitHub.cli --exact --source winget
```

安装后重新打开自己的 PowerShell，再执行：

```powershell
gh --version
gh auth login --hostname github.com --git-protocol https --web
gh auth status --hostname github.com
gh auth setup-git --hostname github.com
```

浏览器登录、设备验证和授权由用户本人完成。不要在聊天中粘贴 Token、密码或私钥；无需把凭据保存到项目。认证完成后可仅告知成功状态，认证不构成代码推送批准。官方流程：[gh auth login](https://cli.github.com/manual/gh_auth_login)。本轮未替用户执行安装、登录或更改 Git credential 配置。

### main 保护建议（仅建议，未实施）

权限 admin 可管理仓库，但私有仓库是否能启用保护还取决于套餐。GitHub 官方说明：Free 的保护能力适用于公开仓库，私有仓库通常需要 Pro/Team/Enterprise；本轮未查套餐，不建议为了保护而改变私有可见性。参见 [官方保护分支说明](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。

套餐允许且 main 首次经批准推送后，建议针对 main：禁止 force push；禁止删除；推荐通过 PR 人工审核合并；有实际审核者时要求批准；有 CI 后再要求存在且名称唯一的必需检查。单人项目不要设置无人能完成的强制第二人审核。若适用，防止管理员意外绕过。是否设置和如何设置均等用户明确批准。

## 5. AI 扩展边界核对

现有 Planner 的 generate/adjust、草稿/正式计划隔离与确定性结算边界可支持目标个性化、可执行性检查和未完成任务调整。补充设计说明在 ARCHITECTURE.md；本轮未新增接口实现、Planner 命令、LLM/Agent/RAG 依赖或任务成果评价。AI 只提建议，用户审核确认，程序负责正式状态与奖励。

## 6. 本轮验收记录

| 检查 | 最终结果 |
| --- | --- |
| TypeScript | 通过 |
| ESLint | 通过，0 警告 |
| Vitest | 3 文件、23 项通过 |
| Webpack 生产构建 | 沙箱外最终构建通过 |
| Webpack 开发 | 启动并完成 Chrome 路由/视觉检查 |
| 生产启动与浏览器复核 | 3002 本机端口启动，三种宽度同一验收清单通过，最终截图来自生产版本 |
| Turbopack 生产构建 | 本轮直接 Next CLI 构建通过，旧问题根因未确认 |
| 审计最终复查 | 全量 5 High、生产 0；依赖和锁文件无变更 |
| 文档与 Git 基础检查 | 文档编码/链接/围栏、diff check、忽略项及敏感信息检查通过 |

视觉模块本地提交为 8f54340；本报告和同步文档另行本地提交，精确 hash 由 Git log 与交付记录，不在提交内写入自身 hash。完整自动检查不等同于用户视觉验收或完整 WCAG 合规认证。
