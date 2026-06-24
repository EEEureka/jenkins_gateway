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

## 阶段 2：只读 Jenkins tools

交付物：

- `jenkins.list_jobs`
- `jenkins.get_job`
- `jenkins.get_build`
- `jenkins.get_console_log`
- `jenkins.get_queue_item`

验收标准：

- folder job path 编码有单测。
- console log 支持截断和分页。
- Jenkins 4xx/5xx 错误能被 MCP 客户端读懂。

## 阶段 3：受控写操作

交付物：

- `jenkins.trigger_build`
- `jenkins.stop_build`
- crumb 自动获取与缓存。
- `JENKINS_MCP_READ_ONLY` 与 `JENKINS_MCP_ENABLE_MUTATIONS` 双开关。
- job allowlist。

验收标准：

- 默认配置下所有写操作拒绝执行。
- 未命中 allowlist 的 job 拒绝执行。
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

## 阶段 5：公开前安全检查

交付物：

- Git 历史敏感信息扫描记录。
- `npm pack --dry-run` 包内容检查记录。
- README、配置说明、Codex 装载示例、常见错误与安全策略。
- release 候选版本。

验收标准：

- 当前文件、Git 历史、测试 fixture、文档示例中没有真实 token。
- `.env.local`、`.codex/config.toml` 和本机日志不会进入 npm 包。
- 默认只读和写操作开关在文档与测试中一致。

## 阶段 6：转公开与 npm 发布

交付物：

- GitHub 仓库从 private 转为 public。
- npm registry 发布 workflow。
- npm package 首个公开版本。
- 新环境 `npx` 验证记录。

验收标准：

- Windows PowerShell 可通过 `npx -y jenkins-gateway-mcp` 启动。
- macOS/Linux shell 可通过同一命令启动。
- 新环境只需 Node.js 和 Jenkins 凭据。
- 发布版本有 changelog。
