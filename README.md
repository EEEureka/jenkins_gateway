# Jenkins Gateway

[中文 README](README.zh.md) | [User Manual](docs/manual.en.md)

Jenkins Gateway is a packaged local gateway for Jenkins HTTP API. It provides a stdio MCP server, a JSON-oriented CLI, and a bundled `jenkins-workflow` agent skill for Jenkins operations. It does not require any Jenkins-side MCP plugin.

Most users should run the published package with `npx` or install it with npm. Source checkout is only needed when developing Jenkins Gateway itself.

## Install Path

Recommended MCP server command:

```bash
npx -y jenkins-gateway mcp stdio
```

Recommended CLI command shape:

```bash
npx -y jenkins-gateway server info --json
```

Use a global install only when you want a persistent `jenkins-gateway` command:

```bash
npm install -g jenkins-gateway
jenkins-gateway server info --json
```

Requirements:

- Node.js 20 or newer.
- A Jenkins base URL, user ID, and API token.
- Network access from the local machine to Jenkins.

Required runtime variables:

| Variable | Description |
| --- | --- |
| `JENKINS_BASE_URL` | Jenkins root URL, for example `https://jenkins.example.com/`. |
| `JENKINS_USER_ID` | Jenkins user ID. |
| `JENKINS_API_TOKEN` | Jenkins API token. |

Protected write tools are denied by default. Enable them explicitly only for trusted jobs or views:

| Variable | Default | Description |
| --- | --- | --- |
| `JENKINS_MCP_ENABLE_PROTECTED_TOOLS` | `false` | Master switch for protected tools. |
| `JENKINS_MCP_PROTECTED_ALLOW_ALL` | `false` | Allow protected tools for all jobs unless a narrower deny rule matches. |
| `JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST` | empty | Comma-separated Jenkins views allowed to use protected tools. |
| `JENKINS_MCP_PROTECTED_VIEW_DENYLIST` | empty | Comma-separated Jenkins views denied from protected tools. |
| `JENKINS_MCP_PROTECTED_JOB_ALLOWLIST` | empty | Comma-separated job paths allowed to use protected tools. |
| `JENKINS_MCP_PROTECTED_JOB_DENYLIST` | empty | Comma-separated job paths denied from protected tools. |

## MCP Setup

Use MCP when the agent platform can launch a local stdio MCP server. MCP setup exposes Jenkins tools to the agent, but it does not install the bundled CLI skill.

### Codex

Add this to `~/.codex/config.toml` for user scope, or `.codex/config.toml` for a project-local setup:

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

To allow protected tools for selected views:

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

CLI registration:

```bash
claude mcp add --scope user --transport stdio \
  --env JENKINS_BASE_URL=https://jenkins.example.com/ \
  --env JENKINS_USER_ID=replace-with-jenkins-user-id \
  --env JENKINS_API_TOKEN=<jenkins-api-token> \
  --env JENKINS_MCP_ENABLE_PROTECTED_TOOLS=false \
  jenkins-gateway -- npx -y jenkins-gateway mcp stdio
```

Project `.mcp.json`:

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

Create `.cursor/mcp.json` for project scope, or `~/.cursor/mcp.json` for user scope:

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

Create `.vscode/mcp.json` for workspace scope, or use the `MCP: Open User Configuration` command for user scope. VS Code uses the `servers` root key:

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

## CLI And Skill Setup

Use CLI+Skill when an agent can run terminal commands and you want a workflow guide that tells the agent how to use Jenkins Gateway reliably. This is separate from MCP setup.

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

Install the bundled skill for the target agent platform:

| Platform | User-level skill install |
| --- | --- |
| Codex | `npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope user` |
| Claude Code | `npx -y jenkins-gateway skill install jenkins-workflow --platform claude --scope user` |
| Cursor | `npx -y jenkins-gateway skill install jenkins-workflow --platform cursor --scope user` |
| VS Code / GitHub Copilot | `npx -y jenkins-gateway skill install jenkins-workflow --platform vscode --scope user` |

For repository-local skills, replace `--scope user` with `--scope project`. To inspect the target path before writing files:

```bash
npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope user --dry-run --json
```

MCP and skills are independent:

- MCP gives the agent callable Jenkins tools.
- CLI+Skill gives the agent a repeatable command-line workflow.
- Installing the MCP server does not automatically install the skill.
- Installing the skill does not configure Jenkins credentials or MCP clients.

## Common CLI Commands

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

## Capabilities

Read-only operations are available by default:

- Probe Jenkins connectivity.
- List Jenkins views and jobs.
- Read job metadata, build metadata, queue items, and parameter definitions.
- Inspect known choices for parameterized Jenkins jobs.

Protected operations require explicit authorization:

- Trigger builds.
- Trigger parameterized builds and optionally verify submitted parameters.
- Stop builds.
- Read console logs. Console logs are not redacted, so this is protected even though it is a read operation.

Protected authorization supports three levels: all jobs, views, and individual jobs. Job rules override view rules; view rules override allow-all; deny wins over allow at the same level.

## Source Checkout For Development

Use source checkout only when changing Jenkins Gateway itself:

```bash
git clone <repo-url>
cd jenkins_gateway
npm install
npm run build
node dist/cli.js server info --json
node dist/cli.js mcp stdio
```

## Documentation

- [User Manual](docs/manual.en.md)
- [中文 README](README.zh.md)
- [Security Policy](SECURITY.md)
