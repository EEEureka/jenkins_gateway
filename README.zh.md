# Jenkins Gateway

[English README](README.md) | [中文使用手册](docs/manual.zh.md)

Jenkins Gateway 是一个面向 Jenkins HTTP API 的本地网关，提供 stdio MCP server、JSON CLI，以及随包发布的 `jenkins-workflow` agent skill。它不要求 Jenkins 服务端安装 MCP 插件。

大多数使用场景应直接通过 `npx` 或 npm 安装成品包。源码部署只建议用于开发 Jenkins Gateway 本身。

## 推荐安装路径

推荐的 MCP server 命令：

```bash
npx -y jenkins-gateway mcp stdio
```

推荐的 CLI 命令形式：

```bash
npx -y jenkins-gateway server info --json
```

如果希望长期保留 `jenkins-gateway` 命令，也可以全局安装：

```bash
npm install -g jenkins-gateway
jenkins-gateway server info --json
```

运行要求：

- Node.js 20 或更高版本。
- Jenkins base URL、用户 ID 和 API token。
- 本机可以访问 Jenkins 服务。

必填运行环境变量：

| 变量 | 说明 |
| --- | --- |
| `JENKINS_BASE_URL` | Jenkins 根地址，例如 `https://jenkins.example.com/`。 |
| `JENKINS_USER_ID` | Jenkins 用户 ID。 |
| `JENKINS_API_TOKEN` | Jenkins API token。 |

受保护写操作默认拒绝。只有在可信 job 或 view 上需要写操作时再显式开启：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `JENKINS_MCP_ENABLE_PROTECTED_TOOLS` | `false` | 受保护工具主开关。 |
| `JENKINS_MCP_PROTECTED_ALLOW_ALL` | `false` | 允许所有 job 使用受保护工具，除非命中更细粒度 deny 规则。 |
| `JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST` | 空 | 允许使用受保护工具的 Jenkins view，逗号分隔。 |
| `JENKINS_MCP_PROTECTED_VIEW_DENYLIST` | 空 | 禁止使用受保护工具的 Jenkins view，逗号分隔。 |
| `JENKINS_MCP_PROTECTED_JOB_ALLOWLIST` | 空 | 允许使用受保护工具的 job path，逗号分隔。 |
| `JENKINS_MCP_PROTECTED_JOB_DENYLIST` | 空 | 禁止使用受保护工具的 job path，逗号分隔。 |

## MCP 配置

当 agent 平台支持启动本地 stdio MCP server 时，使用 MCP 配置。MCP 配置会向 agent 暴露 Jenkins 工具，但不会自动安装随包附带的 CLI skill。

### Codex

用户级配置写入 `~/.codex/config.toml`，项目级配置写入 `.codex/config.toml`：

```toml
[mcp_servers.jenkins-gateway]
command = "npx"
args = ["-y", "jenkins-gateway", "mcp", "stdio"]

[mcp_servers.jenkins-gateway.env]
JENKINS_BASE_URL = "https://jenkins.example.com/"
JENKINS_USER_ID = "replace-with-jenkins-user-id"
JENKINS_API_TOKEN = "<jenkins-api-token>"
JENKINS_MCP_ENABLE_PROTECTED_TOOLS = "false"
```

如果要允许指定 view 下的受保护工具：

```toml
[mcp_servers.jenkins-gateway.env]
JENKINS_BASE_URL = "https://jenkins.example.com/"
JENKINS_USER_ID = "replace-with-jenkins-user-id"
JENKINS_API_TOKEN = "<jenkins-api-token>"
JENKINS_MCP_ENABLE_PROTECTED_TOOLS = "true"
JENKINS_MCP_PROTECTED_ALLOW_ALL = "false"
JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST = "example-stage-view,example-release-view"
```

### Claude Code

CLI 注册：

```bash
claude mcp add --scope user --transport stdio \
  --env JENKINS_BASE_URL=https://jenkins.example.com/ \
  --env JENKINS_USER_ID=replace-with-jenkins-user-id \
  --env JENKINS_API_TOKEN=<jenkins-api-token> \
  --env JENKINS_MCP_ENABLE_PROTECTED_TOOLS=false \
  jenkins-gateway -- npx -y jenkins-gateway mcp stdio
```

项目 `.mcp.json`：

```json
{
  "mcpServers": {
    "jenkins-gateway": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "jenkins-gateway", "mcp", "stdio"],
      "env": {
        "JENKINS_BASE_URL": "https://jenkins.example.com/",
        "JENKINS_USER_ID": "replace-with-jenkins-user-id",
        "JENKINS_API_TOKEN": "<jenkins-api-token>",
        "JENKINS_MCP_ENABLE_PROTECTED_TOOLS": "false"
      }
    }
  }
}
```

### Cursor

项目级配置创建 `.cursor/mcp.json`，用户级配置创建 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "jenkins-gateway": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "jenkins-gateway", "mcp", "stdio"],
      "env": {
        "JENKINS_BASE_URL": "https://jenkins.example.com/",
        "JENKINS_USER_ID": "replace-with-jenkins-user-id",
        "JENKINS_API_TOKEN": "<jenkins-api-token>",
        "JENKINS_MCP_ENABLE_PROTECTED_TOOLS": "false"
      }
    }
  }
}
```

### VS Code / GitHub Copilot

工作区配置创建 `.vscode/mcp.json`，用户级配置可通过 `MCP: Open User Configuration` 命令打开。VS Code 使用 `servers` 作为根字段：

```json
{
  "servers": {
    "jenkins-gateway": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "jenkins-gateway", "mcp", "stdio"],
      "env": {
        "JENKINS_BASE_URL": "https://jenkins.example.com/",
        "JENKINS_USER_ID": "replace-with-jenkins-user-id",
        "JENKINS_API_TOKEN": "<jenkins-api-token>",
        "JENKINS_MCP_ENABLE_PROTECTED_TOOLS": "false"
      }
    }
  }
}
```

## CLI 和 Skill 配置

当 agent 平台可以执行终端命令，并且你希望给 agent 一套稳定的 Jenkins 操作流程时，使用 CLI+Skill 配置。这条路径和 MCP 配置互相独立。

### Windows PowerShell

```powershell
$env:JENKINS_BASE_URL="https://jenkins.example.com/"
$env:JENKINS_USER_ID="replace-with-jenkins-user-id"
$env:JENKINS_API_TOKEN="<jenkins-api-token>"

npx -y jenkins-gateway server info --json
npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope user
```

### macOS / Linux

```bash
export JENKINS_BASE_URL="https://jenkins.example.com/"
export JENKINS_USER_ID="replace-with-jenkins-user-id"
export JENKINS_API_TOKEN="<jenkins-api-token>"

npx -y jenkins-gateway server info --json
npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope user
```

按目标 agent 平台安装随包附带的 skill：

| 平台 | 用户级 skill 安装命令 |
| --- | --- |
| Codex | `npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope user` |
| Claude Code | `npx -y jenkins-gateway skill install jenkins-workflow --platform claude --scope user` |
| Cursor | `npx -y jenkins-gateway skill install jenkins-workflow --platform cursor --scope user` |
| VS Code / GitHub Copilot | `npx -y jenkins-gateway skill install jenkins-workflow --platform vscode --scope user` |

如果希望把 skill 安装到当前仓库内，将 `--scope user` 改成 `--scope project`。写入前可以先查看目标路径：

```bash
npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope user --dry-run --json
```

MCP 和 skill 是两层独立集成：

- MCP 让 agent 获得可调用的 Jenkins 工具。
- CLI+Skill 让 agent 获得可复用的命令行操作流程。
- 安装 MCP server 不会自动安装 skill。
- 安装 skill 不会自动配置 Jenkins 凭据或 MCP 客户端。

## 常用 CLI 命令

```bash
npx -y jenkins-gateway server info --json
npx -y jenkins-gateway view list --json
npx -y jenkins-gateway view get "example-release-view" --json
npx -y jenkins-gateway job list --view "example-release-view" --json
npx -y jenkins-gateway job params "example-upgrade-job" --json
npx -y jenkins-gateway build trigger "example-job" --json
npx -y jenkins-gateway build trigger "example-upgrade-job" --param serviceList=example-component --verify-parameters --json
npx -y jenkins-gateway queue get 123 --json
npx -y jenkins-gateway build get "example-job" 123 --json
npx -y jenkins-gateway build wait "example-job" 123 --json
```

## 能力范围

只读操作默认可用：

- 探测 Jenkins 连接。
- 列出 Jenkins view 和 job。
- 读取 job 元数据、build 元数据、queue item 和构建参数定义。
- 查看参数化 Jenkins job 的已知候选值。

受保护操作需要显式授权：

- 触发构建。
- 触发参数化构建，并可校验参数是否进入实际 build。
- 停止构建。
- 读取 console log。console log 不做脱敏，所以即使是读取操作也被归为受保护工具。

受保护授权支持全部、view、单 job 三种粒度。job 规则优先于 view 规则，view 规则优先于全局 allow-all；同级冲突时 deny 优先。

## 源码开发

只有在开发 Jenkins Gateway 本身时才需要源码路径：

```bash
git clone <repo-url>
cd jenkins_gateway
npm install
npm run build
node dist/cli.js server info --json
node dist/cli.js mcp stdio
```

## 文档

- [中文使用手册](docs/manual.zh.md)
- [English README](README.md)
- [Security Policy](SECURITY.md)
