# LifeQuest

将现实目标转化为用户自主掌控的成长冒险。当前为 **Step 2：应用骨架与本地状态基础**，等待人工验收。

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

开发和构建显式使用 Next.js 官方支持的 `--webpack`：本机 Turbopack CSS 处理子进程在沙箱内外均复现连接失败，Webpack 构建与启动已验证。没有关闭 TypeScript 检查或忽略构建错误。

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

- `main` 保留 Step 1 已验收规划提交 `f327cfe`；Step 2 开发只在本地 `dev` 提交。
- 每模块先检查/测试，再按明确文件路径暂存和 commit；阶段结束报告并等待验收。
- **未经用户明确批准，不 push、不创建远程分支、不创建 PR、不远程合并。** 本轮没有推送代码。
- AGENTS 与文档记录的是协作约束，未配置 GitHub 服务端分支保护，不能宣称为平台强制权限机制。
- 发布批准后先核对批准的 commit、远程归属和 `main` 分支；首次 fetch 并检查远程历史，仅纳入批准提交。发生冲突停止报告，不强推。

GitHub 连接器已认证，但本机没有 `gh`，Git Credential Manager 也未提供可非交互使用的凭据。**连接器认证不等于本机命令行已认证。** 首次批准推送前，请从 [GitHub CLI 官方安装页](https://cli.github.com/) 安装 `gh`，在自己的终端执行官方浏览器认证：

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth status
gh auth setup-git
```

请在官方浏览器页面自行完成登录，不在聊天、项目文件或命令参数中粘贴 Token/密码/私钥。认证本身不代表批准推送。参考：[GitHub 官方认证说明](https://cli.github.com/manual/gh_auth_login)。

## 检查结果与限制

- 类型检查、ESLint（0 警告）、21 项自动测试、Webpack 生产构建已通过。
- Chrome 独立无头上下文检查：7 个路由、导航跳转、损坏数据保留；1440px 桌面和 390px/320px 移动宽度无横向溢出，未捕获运行异常或 console error。测试未访问个人浏览器数据。
- 已人工检查桌面和移动截图；未验证 Edge、Safari、真实手机、屏幕阅读器或完整 MVP 路径。
- `npm audit --omit=dev` 为 0 项漏洞。完整 audit 有 5 项 high，均来自 ESLint → fast-glob/micromatch/braces 的开发依赖链；当前 braces 最新版 3.0.3 仍受公告影响，未使用建议的跨主版本降级强行消除报告。暂不处理来自不可信来源的 glob 输入，后续升级时复核；不把此状态描述为完整依赖审计通过。

产品基准：[PRD](docs/PRD.md) · [架构](docs/ARCHITECTURE.md) · [路线图与本轮记录](docs/ROADMAP.md) · [设计规范](docs/DESIGN.md)。验收 Step 2 后再讨论 Step 3，不自动开始业务开发。
