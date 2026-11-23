# LifeQuest 阅读导航

| 阅读主题 | 内容 |
| --- | --- |
| [产品首页](../README.md) | 产品定位、页面体验与项目工作 |
| [产品案例](PORTFOLIO.md) | 核心问题、方案取舍与5小时变2小时场景 |
| [产品需求](PRD.md) | 用户路径、目标管理、任务成长与调整规则 |
| [AI规划与评测](AI_PLANNER.md) | 模型接入、计划生成与八维质量评价 |
| [AI评测结果](AI_EVAL_RESULTS.md) | 60组实际输出、评分和产品改进依据 |
| [AI评测规范](AI_EVALUATION.md) | 固定输入、评分锚点与首次合格定义 |
| [视觉与交互](DESIGN.md) | 色彩、角色、布局与决策反馈 |
| [时间预算调整案例](REPLAN_CASE_5H_TO_2H.md) | 延期、可选范围与历史保全 |
| [产品架构](ARCHITECTURE.md) | 数据模型、草稿与正式状态、执行与成长 |

## 代码入口

| 目录 | 对应能力 |
| --- | --- |
| src/components | 目标、任务、角色和计划交互 |
| src/domain | 计划确认、任务结算与预算调整 |
| src/services/planner | 模型Adapter、规划指令和输出校验 |
| src/state | 档案状态与模型会话 |
| tests/evals | 固定场景、质量规则与评测记录 |
| scripts | 批量评测、Excel导出和评分回导 |

运行评测见[操作指南](EVALUATION_GUIDE.md)，版本与证据核对见[验证方法](AI_QUALITY_VALIDATION.md)，后续产品重点见[路线图](ROADMAP.md)。
