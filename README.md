# Jenkins Gateway MCP

本项目用于构建一个本地 MCP 网关，让 Codex 等 MCP 客户端可以在不安装 Jenkins 服务器端 MCP 插件的情况下，通过 Jenkins 现有 HTTP API 访问 Jenkins。

当前阶段是方案设计与配置落地，尚未开始实现 MCP 服务代码。项目未完工期间，GitHub 仓库应保持私有；达到可交付状态并完成公开前安全检查后，才转为公共仓库并发布到 npm registry。

## 目标

- 以本地进程方式运行 MCP Server，优先支持 stdio transport，便于 Codex、Claude Desktop 等客户端装载。
- 通过 Jenkins HTTP API 访问现有 Jenkins，不要求服务器安装插件或开放额外入口。
- 支持 Windows 与 macOS，部署方式以 `npx` 为主，不依赖全局安装。
- 账号、token、服务器地址与代码解耦，通过环境变量或本地配置注入。
- 开发期使用私有 GitHub 仓库沉淀实现；交付期转公开仓库并发布公开 npm package，提供 `npx` 部署到新环境的方案。

## 非目标

- 不在 Jenkins 服务器端安装 MCP 插件。
- 不在代码或可提交文档中硬编码 API token。
- 不在第一阶段实现复杂的 Jenkins 编排平台，先提供稳定、可审计的 MCP 工具边界。
- 不在项目未完工、未完成安全检查时公开仓库或发布 npm package。

## 文档

- [技术路线](docs/technical-route.md)
- [配置与凭据管理](docs/configuration.md)
- [发布生命周期与 npx 部署方案](docs/release-and-npx.md)
- [实施计划](docs/implementation-plan.md)
- [验证与测试门禁](docs/validation.md)

## 当前环境记录

Jenkins 环境的可提交模板位于 [config/environments/jenkins.example.env](config/environments/jenkins.example.env)。

本机真实配置记录在 `.env.local`，该文件已被 `.gitignore` 排除，后续不应提交到 GitHub。即使开发期仓库保持私有，真实 token 也必须只存在于本机或部署环境变量中。

## 下一步

1. 初始化 TypeScript/Node.js MCP 服务工程。
2. 实现 Jenkins API client 与只读 MCP tools。
3. 加入写操作开关、job allowlist、日志脱敏与超时控制。
4. 在私有仓库中配置 build/test CI，暂不发布 npm package。
5. 达到可交付状态后，完成公开前安全检查，再转为公共仓库并发布 npm package。
