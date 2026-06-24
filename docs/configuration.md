# 配置与凭据管理

## 配置原则

- 代码不绑定具体 Jenkins 环境。
- token 不进入 Git 历史。
- 可提交文件只包含模板、变量名和非敏感说明。
- 本机真实配置放在 `.env.local`、用户 home 配置目录或本机 Codex config 中。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `JENKINS_BASE_URL` | 是 | 无 | Jenkins 根地址，例如 `https://jenkins.example.com/` |
| `JENKINS_USER_ID` | 是 | 无 | Jenkins 用户 ID |
| `JENKINS_API_TOKEN` | 是 | 无 | Jenkins API token |
| `JENKINS_MCP_PROFILE` | 否 | `default` | 当前环境名称，用于日志和多环境切换 |
| `JENKINS_MCP_CONFIG` | 否 | 无 | 外部 JSON/TOML/YAML 配置文件路径，后续实现时确定格式 |
| `JENKINS_MCP_ENABLE_PROTECTED_TOOLS` | 否 | `false` | 是否允许调用受保护工具 |
| `JENKINS_MCP_PROTECTED_ALLOW_ALL` | 否 | `false` | 是否允许所有 job 调用受保护工具 |
| `JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST` | 否 | 空 | 允许调用受保护工具的 Jenkins view 列表 |
| `JENKINS_MCP_PROTECTED_VIEW_DENYLIST` | 否 | 空 | 禁止调用受保护工具的 Jenkins view 列表 |
| `JENKINS_MCP_PROTECTED_JOB_ALLOWLIST` | 否 | 空 | 允许调用受保护工具的 job path 列表 |
| `JENKINS_MCP_PROTECTED_JOB_DENYLIST` | 否 | 空 | 禁止调用受保护工具的 job path 列表 |
| `JENKINS_MCP_REQUEST_TIMEOUT_MS` | 否 | `30000` | Jenkins API 请求超时时间 |
| `JENKINS_MCP_CONSOLE_LOG_MAX_BYTES` | 否 | `65536` | 单次 console log 返回最大字节数 |
| `JENKINS_MCP_LOG_LEVEL` | 否 | `info` | 日志级别 |

## 当前项目环境

当前仓库只提交通用模板。真实 Jenkins 环境记录在本机 ignored 文件中，不进入 Git 历史。

- profile：`example`
- Jenkins base URL：`https://jenkins.example.com/`
- Jenkins user ID：`replace-with-jenkins-user-id`
- API token：仅记录在 `.env.local` 或部署环境变量中

可提交模板见 [config/environments/jenkins.example.env](../config/environments/jenkins.example.env)。

## 本地 `.env.local`

`.env.local` 用于当前机器调试和验证，已被 `.gitignore` 排除。

CLI 支持以下加载方式：

```powershell
# Windows PowerShell
$env:JENKINS_BASE_URL="https://jenkins.example.com/"
$env:JENKINS_USER_ID="replace-with-jenkins-user-id"
$env:JENKINS_API_TOKEN="<local-token>"
npx -y jenkins-gateway-mcp
```

```bash
# macOS / Linux
export JENKINS_BASE_URL="https://jenkins.example.com/"
export JENKINS_USER_ID="replace-with-jenkins-user-id"
export JENKINS_API_TOKEN="<local-token>"
npx -y jenkins-gateway-mcp
```

## Codex 装载示例

示例文件见 [.codex/jenkins-mcp.example.toml](../.codex/jenkins-mcp.example.toml)。

推荐原则：

- 示例配置可以提交。
- 真实 token 不写入可提交配置。
- 如果必须在 Codex config 中写 env，使用本机私有 config，并确保 `.codex/config.toml` 不提交。

示例：

```toml
[mcp_servers.jenkins]
command = "npx"
args = ["-y", "jenkins-gateway-mcp"]

[mcp_servers.jenkins.env]
JENKINS_MCP_PROFILE = "example"
JENKINS_BASE_URL = "https://jenkins.example.com/"
JENKINS_USER_ID = "replace-with-jenkins-user-id"
JENKINS_API_TOKEN = "<local-token>"
JENKINS_MCP_ENABLE_PROTECTED_TOOLS = "false"
JENKINS_MCP_PROTECTED_ALLOW_ALL = "false"
JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST = ""
JENKINS_MCP_PROTECTED_VIEW_DENYLIST = ""
JENKINS_MCP_PROTECTED_JOB_ALLOWLIST = ""
JENKINS_MCP_PROTECTED_JOB_DENYLIST = ""
```

## 安全约束

- 不提交 `.env.local`、`.codex/config.toml` 或任何包含 token 的文件。
- 服务自身日志必须脱敏 `JENKINS_API_TOKEN`、`Authorization`、crumb。
- 普通读工具默认允许，受保护工具默认拒绝。
- 受保护工具需要 `JENKINS_MCP_ENABLE_PROTECTED_TOOLS=true`，并命中 all / view / job 显式授权。
- `jenkins.get_console_log` 属于受保护工具，不对 console 内容做脱敏，但必须限制最大读取量且不得写入本地日志。
- 生产环境触发构建前应配置 view 或 job 粒度的受保护工具权限。
- 项目未完工或新架构未验收期间 GitHub 仓库保持私有；完成 shared core + CLI + MCP + Codex skill 新架构并通过安全检查后，才转为公共仓库并发布 npm package。
- 如果 token 曾进入公开渠道或 Git 历史，应立即轮换。
