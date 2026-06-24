# 验证与测试门禁

## 阶段门禁

每个实现阶段必须先通过以下本地门禁，再进入下一阶段：

```bash
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
```

`npm test` 等价于依次运行单测和集成测试。

## 当前测试分层

- 单测：`tests/unit/**`
  - 配置解析。
  - 凭据脱敏。
  - Jenkins job path 编码与受保护工具权限判断。
  - MCP server 创建。
- 集成测试：`tests/integration/**`
  - 启动 CLI stdio server。
  - 用 MCP in-memory transport 调用 tools。
  - 用 mock Jenkins HTTP server 验证 API 路径、Basic Auth、crumb、受保护工具开关和日志读取上限。

## CI 门禁

私有仓库开发期只启用 CI，不发布 npm package。

GitHub Actions 工作流位于 `.github/workflows/ci.yml`，覆盖：

- `ubuntu-latest`
- `macos-latest`
- `windows-latest`

每个平台执行：

```bash
npm ci
npm run typecheck
npm run build
npm test
npm pack --dry-run --ignore-scripts
```

## 包内容检查

`npm pack --dry-run --ignore-scripts` 必须确认包内不包含：

- `.env.local`
- `.codex/config.toml`
- npm token
- Jenkins API token
- 本机日志或临时输出

当前项目的 `package.json` 保持 `"private": true`，在 shared core + CLI + MCP + Codex skill 新架构验收和公开前安全检查通过之前，不得发布 npm package。
