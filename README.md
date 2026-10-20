# LifeQuest

将现实目标转化为用户自主掌控的成长冒险。当前为 **Step 2.5：Arcane Indigo 设计优化与工程健康复核**，等待人工验收，尚未开始 Step 3。

当前可浏览基础导航、7 个路由和统一占位页面；尚未实现角色/目标创建、计划编辑、Mock Planner、任务执行或 XP 结算。没有真实 AI、账号或数据库。

## 安装与启动

要求 Node.js 22.17.0 或更高版本，以及 npm。已在 Windows / Node 22.17.0 / npm 10.9.2 验证。

```powershell
cd D:\SCNU\aipm_project\lifequest
npm ci
npm run dev
```

打开 [本地开发站点](http://127.0.0.1:3000)。首次安装需要访问 npm registry；若当前镜像无法访问，可对安装命令指定 `--registry=https://registry.npmjs.org`，无需修改全局 npm 配置。

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm start` 在生产构建完成后启动本机站点。开发与生产服务默认均使用 3000 端口，不要同时启动。停止服务按 Ctrl+C。

开发和构建显式使用 Next.js 官方支持的 `--webpack`。Step 2 曾遇到 Turbopack CSS 子进程连接失败；本轮直接 Turbopack 生产构建已通过，旧错误未复现，但根因尚未确认，默认方案暂不切换。Webpack 已再次验证，没有关闭检查或忽略构建错误；环境证据见 [工程报告](docs/ENGINEERING_HEALTH.md)。

实际版本由 `package-lock.json` 固定：Next.js 16.4.2、React 19.3.1、TypeScript 6.0.3、Tailwind 4.3.3。shadcn/ui 按手工安装方式配置，只纳入 Button/Card 与必要工具；Lucide 提供图标，不预装整套组件。

## 项目结构

```text
docs/                  产品、架构、路线图、设计规范
src/app/               App Router、布局、CSS、占位页面与错误边界
src/components/        应用导航、反馈、占位内容与基础 UI
src/domain/            领域类型、快照运行时校验；无业务命令
src/services/          Repository 接口与 localStorage 实现
src/state/             AppProvider、初始化与串行保存入口
src/test/              测试初始化与仅测试使用的快照夹具
AGENTS.md              长期开发、验收与 Git 约束
```

路由：`/`、`/onboarding`、`/goals`、`/goals/new`、`/goals/[id]`、`/goals/[id]/plan`、`/character`。不存在的目标显示“未找到这个目标”；未知页面提供返回入口。Step 2 不自动跳转建角页，保留骨架浏览，首次用户引导将在 Step 3 实现。

## 本地状态

- 唯一 key：`lifequest:state`，schemaVersion=1。首次空加载仅创建内存空状态，不自动写数据。
- 服务端及客户端首次渲染均为 loading，挂载后才访问 localStorage。
- 使用 `useAppState()` 获取状态、`reload()` 重新读取，`save(update)` 串行提交快照；保存成功后才更新内存，并自动递增全局 revision。
- 损坏 JSON、无效字段、不支持版本、引用不一致均显示错误，保留原始 key，禁止默认空数据覆盖。存储失败保留最后成功状态；本轮没有用户输入表单。
- 每次写入校验 expectedRevision；收到其他标签页的存储变更后冻结保存，需明确重新读取。此机制不提供多标签页原子事务保证。
- 草稿校验允许尚未填写的标题与空阶段，正式计划更严格；确认/编辑权限及 XP 命令留到对应阶段。
- 清除浏览器数据、换设备或变更站点来源会影响数据可用性。Git 不保存 localStorage；请勿通过清空数据解决异常。

## GitHub 与验收流程

远程已关联到你的私有仓库 [Genie1m/LifeQuest](https://github.com/Genie1m/LifeQuest)。通过 GitHub 连接器核实账号、仓库名称、私有可见性及管理员权限后关联；复用了已有仓库，没有重复创建。

- `main` 保留 Step 1 已验收规划提交 `f327cfe`；Step 2 与 Step 2.5 的开发只在本地 `dev` 提交。
- 每模块先检查/测试，再按明确文件路径暂存和 commit；阶段结束报告并等待验收。
- **未经用户明确批准，不 push、不创建远程分支、不创建 PR、不远程合并。** 本轮没有推送代码。
- AGENTS 与文档记录的是协作约束，未配置 GitHub 服务端分支保护，不能宣称为平台强制权限机制。
- 发布批准后先核对批准的 commit、远程归属和 `main` 分支；首次 fetch 并检查远程历史，仅纳入批准提交。发生冲突停止报告，不强推。

GitHub 连接器已认证，但本机仍无法使用 `gh`，`gh auth status` 未能执行。**连接器认证不等于本机命令行已认证。** 首次批准推送前，可使用官方 WinGet 或 MSI 安装方式，重新打开 PowerShell 后在自己的终端执行浏览器认证：

```powershell
winget install --id GitHub.cli --exact --source winget
# 安装完成后重新打开 PowerShell，再执行以下命令
gh --version
gh auth login --hostname github.com --git-protocol https --web
gh auth status
gh auth setup-git
```

请在官方浏览器页面自行完成登录，不在聊天、项目文件或命令参数中粘贴 Token/密码/私钥。认证本身不代表批准推送。参考：[GitHub 官方认证说明](https://cli.github.com/manual/gh_auth_login)。本轮未安装或执行认证，未修改远程设置；main 的保护建议及私有仓库套餐限制见 [工程报告](docs/ENGINEERING_HEALTH.md)。

## 检查结果与限制

- 类型检查、ESLint（0 警告）、23 项自动测试、最终 Webpack 生产构建已通过；Turbopack 直接构建本轮也成功，保留旧问题待复现而非宣称根因修复。
- Chrome 独立无头上下文检查 1440/390/320px 下的 7 个路由、导航、实际字体/字号、Hover/Focus/Disabled、移动底栏遮挡、减少动态效果及损坏数据保留；无横向溢出，未捕获页面异常或 console error。测试未访问个人浏览器数据。
- 设计为 Arcane Indigo，语义色、布局、字体和 9 组对比度结果见 DESIGN.md。截图位于忽略的 `.qa/step25-*.png`；开发侧已查看，用户视觉验收仍待完成。未验证完整 WCAG、Edge、Safari、真实手机、屏幕阅读器或完整 MVP 路径。
- 本轮重新审计并最终复核，production 为 0，全量为 5 High，属于同一 braces 公告的开发依赖传播链；未证明当前站点有可利用的网络入口。未发现可靠兼容修复，依赖和锁文件未修改。具体公告、版本、风险、拒绝的跨主版本修复和复查建议见 ENGINEERING_HEALTH.md。

产品基准：[PRD](docs/PRD.md) · [架构](docs/ARCHITECTURE.md) · [路线图与本轮记录](docs/ROADMAP.md) · [设计规范](docs/DESIGN.md) · [工程健康报告](docs/ENGINEERING_HEALTH.md)。验收 Step 2.5 后再授权 Step 3，不自动开始业务开发或远程发布。
