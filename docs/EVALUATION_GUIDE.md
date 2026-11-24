# 运行AI规划评测

## 输入与工具

默认tests/evals/scenarios60.v2.json固定5类各12个不同合成输入，覆盖基础、预算、偏好、资源、信息缺失和提示注入。每个输入首次只请求一次。旧12例与15×4夹具服务兼容回归，不混入当前分母。

应用使用npm ci安装。Excel导出另使用Codex bundled的@oai/artifact-tool，不属于应用依赖。通过Codex load_workspace_dependencies定位运行库，设置LIFEQUEST_ARTIFACT_MODULES为其node_modules目录，必要时设置LIFEQUEST_ARTIFACT_NODE为同一bundle的Node路径。当前机器也可使用.qa/artifact-runtime/node_modules的本机连接。

采集器在接收Key或收费请求前检查Excel运行库。普通浏览器体验不依赖该运行库；小集兼容评测入口为scripts/evaluate-planner.mjs。

## 冻结与采集

    node scripts/freeze-planner.mjs
    node scripts/freeze-planner.mjs verify <输出的冻结文件路径>

冻结清单包含输入、评分锚点、Prompt/Schema/规则和源码指纹。修改代码或评分文档后，新实验重新冻结，旧记录保持原样。

两个Git Bash终端分别运行：

    LIFEQUEST_ENABLE_REAL_LLM=true npm run dev

    node scripts/eval60.mjs real tests/evals/relay.example.json <冻结文件路径>

核对供应商、模型、端点与协议，在本机输入RUN 60并隐藏输入Key。Key只在当前进程内存，经本机LifeQuest发给供应商。示例模型ID需核对实际权限；可复制配置到.qa/eval-config.json调整，不填Key，不修改全局Codex。

结果逐条写入.qa/evals60/<runId>，结束自动导出evaluation.xlsx；人工分数为空。连接测试是额外请求，不计生成样本；不自动重试收费请求。

    node scripts/eval60.mjs prepare
    node scripts/eval60.mjs mock

prepare生成无结果模板；mock验证采集和Excel流程，来源明确标为Mock。

## Excel与人工评分

明细一行包含全部前提、完整计划、程序结果和7项得分及依据。超长文本放续列，可在编辑栏展开。O:U得分，V评分者，W:AC依据，AD主要问题。

另存evaluation-reviewed.xlsx，按[评分规范](AI_EVALUATION.md)填写，不修改表名、列序或ID。运行：

    node scripts/eval-workbook.mjs reviews .qa/evals60/<runId> .qa/evals60/<runId>/evaluation-reviewed.xlsx
    node scripts/eval60.mjs score .qa/evals60/<runId> .qa/evals60/<runId>/reviews-human-<实际UUID>.json

回导核对运行、ID、得分与依据，不覆盖JSON。AI辅助评价另存kind=ai-assisted，不写入人工结果。

意外中断后可恢复导出，目标文件必须不存在：

    node scripts/eval-workbook.mjs export .qa/evals60/<runId> .qa/evals60/<runId>/recovered.xlsx

只有started标记表示结果未确认，先核对请求状态再决定处理。

## 补跑与规则审计

    node scripts/retry-evals.mjs preview .qa/evals60/<首次runId>
    node scripts/retry-evals.mjs real .qa/evals60/<首次runId>

preview只检查失败名单；real在本机确认RETRY <实际数量>并隐藏输入Key，每条最多补一次，保持原配置与版本。结果独立存.qa/eval-retries/<runId>，用parentRecordId关联。

该入口只接受原始首次批次，不递归合并补跑，也不导出补跑评分Excel。再次补跑需先核对完整父链、剩余名单与版本后另建记录；不回填原首次结果。

    node scripts/review-saved-evals.mjs <首次批次目录> <可选第一轮补跑目录>

规则审计只读已保存输出并另建提示报告，不产生模型请求，目前支持首次及一轮直接补跑。提示数量不等于内容分数。

完整批次、逐条评分与工作簿留在本机。公开材料见[评测与改进案例](AI_EVALUATION_CASE_STUDY.md)，领域可导入与浏览器实际导入分别记录。
