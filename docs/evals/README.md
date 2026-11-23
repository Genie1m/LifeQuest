# AI规划评测证据

[RESULTS.json](RESULTS.json)包含固定60个合成输入、完整选定计划、逐次请求状态、程序结果、7维AI辅助评分及依据。每条保留输入哈希、原记录ID和补跑关联；发布字段通过白名单筛选。

| 内容 | 位置 |
| --- | --- |
| 当前统计与产品结论 | [评测结果](../AI_EVAL_RESULTS.md) |
| 固定输入 | [scenarios60.v2.json](../../tests/evals/scenarios60.v2.json) |
| 评分锚点与合格条件 | [评测规范](../AI_EVALUATION.md) |
| 运行、冻结、Excel与补跑 | [操作指南](../EVALUATION_GUIDE.md) |

数据来自真实中转请求，输入为预先固定的合成场景。内容评分为AI辅助评审，人工评分留空。原始批次、完整Excel与过程截图留在本机.qa；仓库分发当前结果与可复查证据。
