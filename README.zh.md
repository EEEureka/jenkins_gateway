# Jenkins Gateway

[English README](README.md) | [使用手册](docs/manual.zh.md) | [User Manual](docs/manual.en.md)

Jenkins Gateway 是一个面向 Jenkins HTTP API 的本地 CLI 和 stdio MCP Server，用于在 Jenkins 服务器未安装 MCP 插件的情况下，让 Codex 等 MCP 客户端访问 Jenkins。

网关运行在用户本机，通过环境变量读取 Jenkins 凭据，再以标准 Jenkins HTTP API 调用远端 Jenkins。

## 架构

- shared core：Jenkins HTTP 访问、配置、脱敏、参数解析、受保护工具授权和工作流。
- CLI：服务本地脚本、CI 和 Codex skill。
- MCP stdio server：服务 Codex 和其他 MCP 客户端。
- Codex skill：沉淀可复用 Jenkins 工作流。

## 运行要求

- Node.js 20 或更新版本。
- Jenkins 用户 ID 和 API token。
- 本机可以访问 Jenkins 服务器。

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

### npx 包部署

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

## Codex MCP 配置

源码部署配置：

```toml
[mcp_servers.jenkins]
command = "node"
args = ["D:/path/to/jenkins_gateway/dist/cli.js", "mcp", "stdio"]

[mcp_servers.jenkins.env]
JENKINS_MCP_PROFILE = "example"
JENKINS_BASE_URL = "https://jenkins.example.com/"
JENKINS_USER_ID = "replace-with-jenkins-user-id"
JENKINS_API_TOKEN = "<jenkins-api-token>"
JENKINS_MCP_ENABLE_PROTECTED_TOOLS = "false"
JENKINS_MCP_PROTECTED_ALLOW_ALL = "false"
```

npx 包配置：

```toml
[mcp_servers.jenkins]
command = "npx"
args = ["-y", "jenkins-gateway", "mcp", "stdio"]
```

Jenkins 凭据可以写在本机 Codex MCP 环境变量块中，也可以由启动 Codex 的 shell 环境提供。

## 能力范围

默认允许的只读能力：

- Jenkins 连接探测。
- 查询 Jenkins view 和 job。
- 读取 job 元数据、build 元数据、queue item 和构建参数。

默认拒绝的受保护能力：

- 触发构建。
- 停止构建。
- 读取 console log。

受保护权限支持 all、view、job 三种粒度。优先级为 job > view > all；同级冲突时 deny 优先。

## 文档

- [使用手册](docs/manual.zh.md)
- [User Manual](docs/manual.en.md)
- [安全策略](SECURITY.md)

完整 CLI 参考、MCP tool 列表、配置变量、受保护权限规则和架构设计见使用手册。
