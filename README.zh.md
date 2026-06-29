# Jenkins Gateway

[English README](README.md) | [中文使用手册](docs/manual.zh.md)

Jenkins Gateway 是一个面向 Jenkins HTTP API 的本地 CLI 和 stdio MCP server。它可以让 Codex 和其他 MCP 客户端连接既有 Jenkins 服务，而不需要在 Jenkins 服务端安装 MCP 插件。

网关运行在用户本机，从本机环境变量或客户端配置中读取 Jenkins 凭据，并通过 Jenkins 标准 HTTP API 发起请求。

## 架构

- 共享 core：负责 Jenkins HTTP 访问、配置、脱敏、参数处理、受保护工具授权和工作流。
- CLI：面向本地脚本、CI、调试和 agent skill。
- MCP stdio server：面向 Codex 和其他 MCP 客户端。
- `jenkins-workflow` skill：沉淀可复用的 Jenkins 操作流程。
- Skill 安装器：支持 Codex、Claude Code、Cursor 和 VS Code。

## 环境要求

- Node.js 20 或更高版本。
- Jenkins 用户 ID 和 API token。
- 本机可以访问 Jenkins 服务。

## 快速部署

### Windows PowerShell，源码部署

```powershell
git clone <repo-url>
cd jenkins_gateway
npm install
npm run build

$env:JENKINS_BASE_URL="https://jenkins.example.com/"
$env:JENKINS_USER_ID="replace-with-jenkins-user-id"
$env:JENKINS_API_TOKEN="<jenkins-api-token>"
$env:JENKINS_MCP_ENABLE_PROTECTED_TOOLS="false"

node dist/cli.js server info --json
node dist/cli.js mcp stdio
```

### macOS / Linux，源码部署

```bash
git clone <repo-url>
cd jenkins_gateway
npm install
npm run build

export JENKINS_BASE_URL="https://jenkins.example.com/"
export JENKINS_USER_ID="replace-with-jenkins-user-id"
export JENKINS_API_TOKEN="<jenkins-api-token>"
export JENKINS_MCP_ENABLE_PROTECTED_TOOLS="false"

node dist/cli.js server info --json
node dist/cli.js mcp stdio
```

### npx 包

```powershell
# Windows PowerShell
$env:JENKINS_BASE_URL="https://jenkins.example.com/"
$env:JENKINS_USER_ID="replace-with-jenkins-user-id"
$env:JENKINS_API_TOKEN="<jenkins-api-token>"
npx -y jenkins-gateway mcp stdio
```

```bash
# macOS / Linux
export JENKINS_BASE_URL="https://jenkins.example.com/"
export JENKINS_USER_ID="replace-with-jenkins-user-id"
export JENKINS_API_TOKEN="<jenkins-api-token>"
npx -y jenkins-gateway mcp stdio
```

## 快速配置 MCP

当 agent 平台支持本地 stdio MCP server 时，使用 MCP 模式。server 命令是：

```bash
npx -y jenkins-gateway mcp stdio
```

Jenkins 凭据应配置在 MCP 客户端的环境变量块中。Codex、Claude Code、Cursor、VS Code 的示例见 [中文使用手册](docs/manual.zh.md)。

## 快速配置 CLI

当 agent 平台可以直接运行 shell 命令时，可以使用 CLI 模式：

```bash
npx -y jenkins-gateway server info --json
```

MCP 或 npx 不会自动安装随包附带的 `jenkins-workflow` skill。需要使用 skill 引导的 CLI 工作流时，需要单独安装：

```bash
npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope project
```

其他平台可使用 `--platform claude`、`--platform cursor` 或 `--platform vscode`。用户级安装使用 `--scope user`。

## 能力

默认启用只读操作：

- 探测 Jenkins 连接。
- 列出 Jenkins view 和 job。
- 读取 job 元数据、build 元数据、queue item 和构建参数。
- 通过 CLI 查看 build 和 queue 状态。

受保护操作默认拒绝，必须显式授权：

- 触发构建。
- 触发参数化构建，并可校验参数是否进入实际 build。
- 停止构建。
- 读取 console log。

受保护授权支持全部、view、job 三种粒度。job 规则优先于 view 规则，view 规则优先于全部规则；同级冲突时 deny 优先。

## 文档

- [中文使用手册](docs/manual.zh.md)
- [English README](README.md)
- [Security Policy](SECURITY.md)

完整 CLI 参考、MCP tool 列表、配置变量、受保护工具规则和设计细节见中文使用手册。
