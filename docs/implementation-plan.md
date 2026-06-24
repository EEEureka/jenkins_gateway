# 实施计划

## 阶段 0：仓库初始化

交付物：

- `package.json`
- `tsconfig.json`
- `src/cli.ts`
- `src/server.ts`
- `src/jenkins/client.ts`
- `src/config.ts`
- `tests/**`

验收标准：

- `npm install` 成功。
- `npm run build` 成功。
- CLI 可通过 `node dist/cli.js` 启动并输出 MCP stdio server。
- GitHub 仓库保持 private。

## 阶段 1：配置加载与连接探测

交付物：

- 环境变量解析。
- token 脱敏日志。
- Jenkins base URL 规范化。
- `jenkins.get_server_info` tool。

验收标准：

- 缺少必要配置时返回明确错误。
- 使用 `.env.local` 可探测 Jenkins 根 API。
- stdout 不出现日志噪音。

## 阶段 2：普通只读 Jenkins tools

交付物：

- `jenkins.list_jobs`
- `jenkins.get_job`
- `jenkins.get_build`
- `jenkins.get_queue_item`

验收标准：

- folder job path 编码有单测。
- Jenkins 4xx/5xx 错误能被 MCP 客户端读懂。

## 阶段 3：受保护工具权限

交付物：

- `jenkins.get_console_log`
- `jenkins.trigger_build`
- `jenkins.stop_build`
- crumb 自动获取与缓存。
- `JENKINS_MCP_ENABLE_PROTECTED_TOOLS` 主开关。
- all / view / job 三级受保护权限配置。

验收标准：

- 默认配置下所有受保护工具拒绝执行。
- 未命中显式允许范围的 job 拒绝执行受保护工具。
- 权限粒度按 job > view > all 判断。
- 同级权限冲突时 deny 优先。
- `get_console_log` 默认限制最大读取量，不对 console 内容做脱敏，不写入本地日志。
- 写操作失败时不会自动重复提交。

## 阶段 4：私有仓库内集成验证

交付物：

- package bin。
- GitHub Actions build/test。
- Codex 本机装载示例。
- Windows 与 macOS/Linux 启动验证记录。
- 测试门禁说明文档。

验收标准：

- Windows PowerShell 可在源码构建后启动 MCP server。
- macOS/Linux shell 可在源码构建后启动 MCP server。
- 私有仓库 CI 通过。
- 不发布 npm package。

## 阶段 5：私有预发布与演进准备

交付物：

- Git 历史敏感信息扫描记录。
- `npm pack --dry-run` 包内容检查记录。
- README、配置说明、Codex 装载示例、常见错误与安全策略。
- 私有预发布候选版本。

验收标准：

- 当前文件、Git 历史、测试 fixture、文档示例中没有真实 token。
- `.env.local`、`.codex/config.toml` 和本机日志不会进入 npm 包。
- 受保护工具主开关、默认拒绝和 job/view/all 权限规则在文档与测试中一致。
- GitHub 仓库继续保持 private。
- `package.json` 继续保持 `"private": true`。
- 不发布 npm package。

## 阶段 6：shared core + CLI 重构

交付物：

- `src/core/**`
- `src/cli/**`
- `jenkins-gateway mcp stdio`
- `jenkins-gateway server info --json`
- `jenkins-gateway job list|get --json`
- `jenkins-gateway build trigger --json`

验收标准：

- 现有 MCP tools 行为不回退。
- CLI 命令输出稳定 JSON。
- MCP 和 CLI 共用同一套 Jenkins client 与权限判断。
- 单测和集成测试通过。

## 阶段 7：受保护工具授权与参数化构建助手

交付物：

- `jenkins.list_views`
- `jenkins.get_view`
- `jenkins.get_build_parameters`
- `JENKINS_MCP_PROTECTED_ALLOW_ALL`
- `JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST`
- `JENKINS_MCP_PROTECTED_VIEW_DENYLIST`
- `JENKINS_MCP_PROTECTED_JOB_ALLOWLIST`
- `JENKINS_MCP_PROTECTED_JOB_DENYLIST`
- Extended Choice 参数候选值解析。

验收标准：

- 受保护工具默认拒绝，只有命中显式允许范围才可调用。
- 权限粒度按 job > view > all 判断。
- 同级 deny 优先于 allow。
- 支持全部允许但排除指定 view/job。
- 支持 view 允许但排除其中指定 job。
- 参数化构建触发前完成参数合法性校验。
- mock Jenkins 集成测试覆盖 View 和参数页 HTML。

## 阶段 8：Codex Skill 与工作流命令

交付物：

- `skills/jenkins-workflow/SKILL.md`
- `skills/jenkins-workflow/references/workflows.md`
- `jenkins-gateway workflow upgrade-component --json`

验收标准：

- skill 不保存凭据和真实环境配置。
- workflow 命令可完成查询前置构建、校验参数、触发升级、等待结果和输出摘要。
- 复杂 Jenkins 操作优先通过 CLI workflow 完成，MCP 继续保留通用 tool 能力。

## 阶段 9：新架构验收与公开前安全检查

交付物：

- shared core、CLI、MCP、Skill 的端到端验收记录。
- 新架构后的 Git 历史敏感信息扫描记录。
- 新架构后的 `npm pack --dry-run` 包内容检查记录。
- README、配置说明、Codex 装载示例、Skill 使用说明、常见错误与安全策略。
- 公开发布候选版本。

验收标准：

- 阶段 6-8 的所有单测和集成测试门禁均通过。
- 当前文件、Git 历史、测试 fixture、文档示例中没有真实 token、真实 Jenkins URL 或真实用户标识。
- `.env.local`、`.codex/config.toml`、本机日志和临时构建产物不会进入 npm 包。
- 受保护工具主开关、job/view/all 优先级和同级 deny 优先规则在文档与测试中一致。
- 新环境可通过私有源码构建验证 `jenkins-gateway mcp stdio` 与核心 CLI workflow。
- GitHub 仓库在本阶段结束前仍保持 private。
- 本阶段结束前仍不发布 npm package。

## 阶段 10：转公开与 npm 发布

交付物：

- GitHub 仓库从 private 转为 public。
- npm registry 发布 workflow。
- npm package 首个公开版本。
- 新环境 `npx` 验证记录。

验收标准：

- 阶段 9 全部验收标准通过后，才允许进入本阶段。
- Windows PowerShell 可通过 `npx -y jenkins-gateway-mcp` 启动。
- macOS/Linux shell 可通过同一命令启动。
- 新环境只需 Node.js 和 Jenkins 凭据。
- 发布版本有 changelog。
