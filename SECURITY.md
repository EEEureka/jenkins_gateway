# Security Policy

## Repository Visibility

This repository should stay private while the project is unfinished. It may be converted to a public repository only after the project reaches a deliverable state and passes a pre-publication security review.

Do not publish the npm package before that public-readiness checkpoint is complete.

## Credential Handling

- Do not commit real Jenkins credentials, npm tokens, authorization headers, crumbs, or environment-specific secrets.
- Local files such as `.env.local` and `.codex/config.toml` are ignored by Git and should stay local to each machine.
- Use environment variables for `JENKINS_BASE_URL`, `JENKINS_USER_ID`, and `JENKINS_API_TOKEN`.
- Keep MCP write operations disabled by default.
- Rotate the Jenkins API token immediately if it is ever copied into Git history, issue text, logs, screenshots, or public chat.
- Do not include full console logs in bug reports if they may contain secrets.

## Public-Readiness Review

Before converting the repository to public or publishing to npm:

- Scan the current working tree for real Jenkins tokens and npm tokens.
- Scan Git history for credentials.
- Run `npm pack --dry-run` and inspect the package file list.
- Confirm examples use placeholders rather than real credentials.
- Confirm logs redact `Authorization`, Jenkins crumb values, and `JENKINS_API_TOKEN`.

## Reporting

While the repository is private, report security issues through the project owner channel. After the repository becomes public, add the public reporting path here.
