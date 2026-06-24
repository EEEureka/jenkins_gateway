# 发布生命周期与 npx 部署方案

## 发布原则

本项目采用两阶段发布策略：

- 开发期和新架构演进期：GitHub 仓库保持私有，不发布 npm package。
- 交付期：完成 shared core + CLI + MCP + Codex skill 新架构并通过公开前安全检查后，才将仓库转为公共仓库，并发布到 npm registry。

这样既保留后续公共分发和 `npx` 部署能力，又避免未完工代码、内部记录或误放的敏感信息过早进入公共渠道。

## 开发期与新架构演进期：私有 GitHub 仓库

开发期和新架构演进期仓库可以提交：

- `src/**`
- `package.json`
- `tsconfig.json`
- `README.md`
- `docs/**`
- `.env.example`
- `config/environments/*.example.env`
- `.codex/jenkins-mcp.example.toml`
- GitHub Actions build/test workflow

开发期和新架构演进期仓库不应提交：

- `.env.local`
- `.codex/config.toml`
- npm publish token
- Jenkins API token
- 任何真实 Jenkins crumb、Authorization header、console 中的敏感内容
- 构建产物，除非后续明确采用 committed dist 策略

开发期和新架构演进期 CI 只做 build/test/lint，不执行 `npm publish`。

## 交付期：转公开与 npm registry

只有同时满足以下条件，才允许转为公共仓库并发布 npm package：

- 新架构验收通过：shared core、CLI、MCP 和 Codex skill 均完成，且端到端 workflow 验证通过。
- MCP server 功能闭环：至少包含配置加载、连接探测、普通只读 tools、受保护 tools、错误处理和服务日志脱敏。
- 跨平台验证通过：Windows PowerShell 与 macOS/Linux shell 均可启动。
- 默认安全行为明确：普通读工具默认允许，受保护工具默认拒绝且需要显式授权。
- 文档完整：README、配置说明、Codex 装载示例、常见错误和安全策略可被新用户直接使用。
- 公开前安全检查通过：Git 历史、当前文件、测试 fixture、日志样例中没有真实 token。
- npm 包内容检查通过：`npm pack --dry-run` 不包含本地配置或敏感文件。

交付发布流程：

1. 冻结 release 分支或 tag 候选版本。
2. 执行新架构端到端验收。
3. 执行公开前安全检查。
4. 将 GitHub 仓库从 private 转为 public。
5. 创建 release tag。
6. GitHub Actions 构建、测试并发布到 npm registry。
7. 用全新环境验证 `npx` 和 Codex 装载。

## package 命名

优先尝试未 scoped 包名：

```json
{
  "name": "jenkins-gateway-mcp",
  "bin": {
    "jenkins-gateway-mcp": "dist/cli.js"
  }
}
```

如果 npm registry 上该名称已被占用，改用公开 scoped package：

```json
{
  "name": "@<scope>/jenkins-gateway-mcp",
  "bin": {
    "jenkins-gateway-mcp": "dist/cli.js"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

后续文档中的 `jenkins-gateway-mcp` 需要随最终包名同步调整。

## npm 发布流程

### 1. 本地准备

```bash
npm install
npm run build
npm test
npm pack --dry-run
```

`npm pack --dry-run` 用于确认包内不会包含 `.env.local`、`.codex/config.toml` 或其他敏感文件。

### 2. npm token

在 npm 创建 automation token，并保存到 GitHub repository secret：

```text
NPM_TOKEN=<npm-automation-token>
```

不要把 npm token 写入仓库文件。

### 3. GitHub Actions 发布

建议只在 tag 或 GitHub Release 时发布。开发期不要启用发布 job，或让发布 job 只在明确的 release tag 上运行。

```yaml
name: publish

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 新环境 npx 使用方式

以下命令只适用于 npm package 已正式发布之后。

Windows PowerShell：

```powershell
$env:JENKINS_BASE_URL="https://jenkins.example.com/"
$env:JENKINS_USER_ID="replace-with-jenkins-user-id"
$env:JENKINS_API_TOKEN="<jenkins-api-token>"
$env:JENKINS_MCP_ENABLE_PROTECTED_TOOLS="false"
npx -y jenkins-gateway-mcp
```

macOS / Linux：

```bash
export JENKINS_BASE_URL="https://jenkins.example.com/"
export JENKINS_USER_ID="replace-with-jenkins-user-id"
export JENKINS_API_TOKEN="<jenkins-api-token>"
export JENKINS_MCP_ENABLE_PROTECTED_TOOLS="false"
npx -y jenkins-gateway-mcp
```

如果最终采用 scoped package，则命令替换为：

```bash
npx -y @<scope>/jenkins-gateway-mcp
```

## Codex 中装载

在本机 Codex 配置中增加 MCP server：

```toml
[mcp_servers.jenkins]
command = "npx"
args = ["-y", "jenkins-gateway-mcp"]

[mcp_servers.jenkins.env]
JENKINS_MCP_PROFILE = "example"
JENKINS_BASE_URL = "https://jenkins.example.com/"
JENKINS_USER_ID = "replace-with-jenkins-user-id"
JENKINS_API_TOKEN = "<jenkins-api-token>"
JENKINS_MCP_ENABLE_PROTECTED_TOOLS = "false"
JENKINS_MCP_PROTECTED_ALLOW_ALL = "false"
```

这类本机配置不应提交到仓库。

## 开发期临时验证

发布 npm package 前，可以在有私有仓库权限的机器上使用源码方式验证：

```bash
git clone <private-repo-url>
cd jenkins_gateway
npm install
npm run build
node dist/cli.js
```

如需通过 GitHub URL 临时安装，应只在权限可控的内部环境使用，并确保 package 的 `prepare` 或 `postinstall` 能完成 TypeScript 构建。

## 版本策略

- `0.1.x`：普通只读工具、基础连接、受保护 console log。
- `0.2.x`：带安全开关的构建触发与停止。
- `0.3.x`：all/view/job 受保护权限、多 profile 配置、资源暴露。
- `1.0.0`：shared core + CLI + MCP + Codex skill 新架构稳定、文档完整、跨平台验证通过，可作为转公开和 npm 发布候选。
