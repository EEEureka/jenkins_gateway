# Security Policy

## Credential Handling

- Provide Jenkins credentials through environment variables or the MCP client's local environment configuration.
- Required credential variables are `JENKINS_BASE_URL`, `JENKINS_USER_ID`, and `JENKINS_API_TOKEN`.
- Keep MCP protected operations disabled unless the target Jenkins jobs or views have been explicitly authorized.
- Rotate the Jenkins API token immediately if it is exposed in screenshots, logs, issue text, chat messages, or other shared material.
- Avoid sharing full Jenkins console logs when they may contain secrets.

## Protected Operations

The following operations are protected by default:

- Triggering builds.
- Stopping builds.
- Reading console logs.

Protected operations require `JENKINS_MCP_ENABLE_PROTECTED_TOOLS=true` and an allow rule that matches the target job or view. See the user manual for the full authorization order.

## Logging

- MCP stdout is reserved for protocol messages.
- Diagnostic logs must not include API tokens, Jenkins crumbs, or authorization header values.
- Console log content is returned only through the protected console log tool and is not redacted by the gateway.

## Reporting

Report security issues through the repository owner or maintainer channel.
