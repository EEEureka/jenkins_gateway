# Jenkins Gateway

[Chinese manual](docs/manual.zh.md) | [User Manual](docs/manual.en.md)

Jenkins Gateway is a local CLI and stdio MCP server for Jenkins HTTP API. It lets Codex and other MCP clients work with an existing Jenkins server without installing any Jenkins-side MCP plugin.

The gateway runs on the user's machine, reads Jenkins credentials from local environment variables, and calls Jenkins through standard HTTP API requests.

## Architecture

- Shared core for Jenkins HTTP access, configuration, redaction, parameters, protected-tool authorization, and workflows.
- CLI entrypoints for local scripts, CI, and Codex skills.
- MCP stdio server for Codex and other MCP clients.
- Codex skill content for repeatable Jenkins workflows.
- Skill installer for Codex, Claude Code, Cursor, and VS Code.

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

## Quick MCP Configuration

Use MCP mode when the agent platform supports local stdio MCP servers. The server command is:

```bash
npx -y jenkins-gateway mcp stdio
```

Configure Jenkins credentials in the MCP client's environment block. See the manual for Codex, Claude Code, Cursor, and VS Code examples.

## Quick CLI Configuration

Use CLI mode when the agent platform can run shell commands directly:

```bash
npx -y jenkins-gateway server info --json
```

The bundled `jenkins-workflow` skill is not installed automatically by MCP or npx. Install it separately when you want skill-guided CLI workflows:

```bash
npx -y jenkins-gateway skill install jenkins-workflow --platform codex --scope project
```

Use `--platform claude`, `--platform cursor`, or `--platform vscode` for other agent platforms. Use `--scope user` for a user-level installation.

## Capabilities

Read-only operations are enabled by default:

- Probe server connectivity.
- List Jenkins views and jobs.
- Read job metadata, build metadata, queue items, and build parameters.
- Inspect build and queue state from the CLI.

Protected operations are denied by default and require explicit authorization:

- Trigger builds.
- Trigger parameterized builds with optional parameter verification.
- Stop builds.
- Read console logs.

Protected authorization supports all, view, and job granularity. Job rules take priority over view rules, view rules take priority over all, and deny rules win over allow rules at the same level.

## Documentation

- [User Manual](docs/manual.en.md)
- [中文使用手册](docs/manual.zh.md)
- [Security Policy](SECURITY.md)

See the manual for the complete CLI reference, MCP tool list, configuration variables, protected-tool rules, and design details.
