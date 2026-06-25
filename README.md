# Jenkins Gateway

[Chinese manual](docs/manual.zh.md) | [User Manual](docs/manual.en.md)

Jenkins Gateway is a local CLI and stdio MCP server for Jenkins HTTP API. It lets Codex and other MCP clients work with an existing Jenkins server without installing any Jenkins-side MCP plugin.

The gateway runs on the user's machine, reads Jenkins credentials from local environment variables, and calls Jenkins through standard HTTP API requests.

## Architecture

- Shared core for Jenkins HTTP access, configuration, redaction, parameters, protected-tool authorization, and workflows.
- CLI entrypoints for local scripts, CI, and Codex skills.
- MCP stdio server for Codex and other MCP clients.
- Codex skill content for repeatable Jenkins workflows.

## Requirements

- Node.js 20 or newer.
- A Jenkins user ID and API token.
- Network access from the local machine to the Jenkins server.

## Quick Deployment

### Windows PowerShell, source checkout

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

### macOS / Linux, source checkout

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

### npx package

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

## Codex MCP Configuration

Source checkout configuration:

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

npx package configuration:

```toml
[mcp_servers.jenkins]
command = "npx"
args = ["-y", "jenkins-gateway", "mcp", "stdio"]
```

Put Jenkins credentials in the local Codex MCP environment block or in the shell environment that starts Codex.

## Capabilities

Read-only operations are enabled by default:

- Probe server connectivity.
- List Jenkins views and jobs.
- Read job metadata, build metadata, queue items, and build parameters.

Protected operations are denied by default and require explicit authorization:

- Trigger builds.
- Stop builds.
- Read console logs.

Protected authorization supports all, view, and job granularity. Job rules take priority over view rules, view rules take priority over all, and deny rules win over allow rules at the same level.

## Documentation

- [User Manual](docs/manual.en.md)
- [中文使用手册](docs/manual.zh.md)
- [Security Policy](SECURITY.md)

See the manual for the complete CLI reference, MCP tool list, configuration variables, protected-tool rules, and design details.
