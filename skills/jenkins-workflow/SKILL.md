---
name: jenkins-workflow
description: Use this skill for Jenkins operations through the jenkins-gateway CLI, especially release, stage, component upgrade, build status, queue status, and parameterized build workflows.
disable-model-invocation: true
---

# Jenkins Workflow Skill

Use this skill when an agent needs to operate Jenkins through this repository's `jenkins-gateway` CLI, especially for release, stage, component upgrade, or parameterized build workflows.

Do not store Jenkins URLs, user IDs, tokens, job names from private environments, or local Codex config in this skill. Runtime credentials and environment selection must come from environment variables or the caller's private MCP/CLI configuration.

## Safety Rules

- Treat `jenkins.get_console_log`, build trigger, stop build, and workflow commands as protected operations.
- Before running a protected operation, confirm the target job path, target component, and expected environment branch class.
- Prefer View-scoped protected authorization for repeated release workflows.
- Use job-scoped authorization for one-off or high-risk operations.
- Do not bypass CLI authorization with raw Jenkins HTTP calls.
- Do not write console log content to local files unless the user explicitly asks for an artifact.

## CLI Usage

Use JSON output for all automated calls:

```bash
jenkins-gateway server info --json
jenkins-gateway view list --json
jenkins-gateway view get "example-release-view" --json
jenkins-gateway job list --view "example-release-view" --json
jenkins-gateway job params "example-upgrade-job" --json
jenkins-gateway build get "example-job" 123 --json
jenkins-gateway queue get 123 --json
jenkins-gateway build trigger "example-job" --param key=value --verify-parameters --json
```

For component upgrade workflows, prefer the bundled workflow command:

```bash
jenkins-gateway workflow upgrade-component \
  --compile-job "example-front-release-build" \
  --compile-build lastBuild \
  --upgrade-job "example-release-upgrade-job" \
  --component "example-front-release-component" \
  --parameter serviceList \
  --wait \
  --json
```

## Workflow Routing

Read `references/workflows.md` before executing a multi-step Jenkins workflow.

For a component upgrade:

1. Confirm the compile job and upgrade job.
2. Read the compile build and require it to be finished and successful.
3. Read the upgrade job parameters and verify the component is an accepted value when choices are available.
4. Trigger the upgrade job through `workflow upgrade-component`.
5. If `--wait` is used, report queue id, build number, and final build result.

For direct parameterized triggers, prefer `--verify-parameters` so the CLI fails when Jenkins accepts the queue item but the executable build does not contain the submitted values.
