# Jenkins Workflow Reference

This reference intentionally uses placeholder names. Do not replace them with private Jenkins environment values in committed files.

## Component Upgrade

The preferred command is:

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

Expected behavior:

- Reads the compile build before triggering the upgrade.
- Rejects the workflow if the compile build is still running or ended with a non-success result.
- Reads upgrade job parameter definitions.
- Validates the component against known choices when Jenkins exposes them.
- Triggers the upgrade job with the selected parameter.
- When waiting is enabled, follows the queue item to the executable build and waits for final result.

For direct parameterized build triggers outside this workflow, prefer:

```bash
jenkins-gateway build trigger "example-upgrade-job" \
  --param serviceList=example-component \
  --verify-parameters \
  --json
```

The verification step reads the executable build's `actions[].parameters[]` and fails if Jenkins accepted the queue item but dropped or emptied a submitted parameter.

## Authorization

Protected tools are controlled by:

```text
JENKINS_MCP_ENABLE_PROTECTED_TOOLS
JENKINS_MCP_PROTECTED_ALLOW_ALL
JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST
JENKINS_MCP_PROTECTED_VIEW_DENYLIST
JENKINS_MCP_PROTECTED_JOB_ALLOWLIST
JENKINS_MCP_PROTECTED_JOB_DENYLIST
```

Resolution order:

1. Disabled protected tools deny all protected operations.
2. Job denylist.
3. Job allowlist.
4. View denylist.
5. View allowlist.
6. Allow all.
7. Default deny.

Job-level rules are more specific than View-level rules. Within the same level, deny takes precedence.
