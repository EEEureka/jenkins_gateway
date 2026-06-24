import type { JenkinsGatewayConfig } from "./config.js";
import type { JenkinsJobList } from "./jenkins-client.js";
import { isJobAllowed, normalizeJobPath } from "./job-paths.js";

export type ProtectedToolDecisionReason =
  | "protected-tools-disabled"
  | "matched-protected-job-denylist"
  | "matched-protected-job-allowlist"
  | "matched-protected-view-denylist"
  | "matched-protected-view-allowlist"
  | "matched-protected-allow-all"
  | "default-deny";

export interface ProtectedToolDecision {
  allowed: boolean;
  reason: ProtectedToolDecisionReason;
  toolName: string;
  jobPath: string;
  matchedView?: string;
  matchedJob?: string;
}

export interface ProtectedToolDecisionInput {
  config: JenkinsGatewayConfig;
  toolName: string;
  jobPath: string;
  listJobsInView(viewName: string): Promise<JenkinsJobList>;
}

export async function explainProtectedToolDecision({
  config,
  toolName,
  jobPath,
  listJobsInView
}: ProtectedToolDecisionInput): Promise<ProtectedToolDecision> {
  const normalizedJobPath = normalizeJobPath(jobPath);

  if (!config.enableProtectedTools) {
    return deny("protected-tools-disabled", toolName, normalizedJobPath);
  }

  if (isJobAllowed(normalizedJobPath, config.protectedJobDenylist)) {
    return deny("matched-protected-job-denylist", toolName, normalizedJobPath, {
      matchedJob: normalizedJobPath
    });
  }

  if (isJobAllowed(normalizedJobPath, config.protectedJobAllowlist)) {
    return allow("matched-protected-job-allowlist", toolName, normalizedJobPath, {
      matchedJob: normalizedJobPath
    });
  }

  for (const viewName of config.protectedViewDenylist) {
    if (await viewContainsJob(viewName, normalizedJobPath, listJobsInView)) {
      return deny("matched-protected-view-denylist", toolName, normalizedJobPath, {
        matchedView: viewName
      });
    }
  }

  for (const viewName of config.protectedViewAllowlist) {
    if (await viewContainsJob(viewName, normalizedJobPath, listJobsInView)) {
      return allow("matched-protected-view-allowlist", toolName, normalizedJobPath, {
        matchedView: viewName
      });
    }
  }

  if (config.protectedAllowAll) {
    return allow("matched-protected-allow-all", toolName, normalizedJobPath);
  }

  return deny("default-deny", toolName, normalizedJobPath);
}

export function assertProtectedToolDecision(decision: ProtectedToolDecision): void {
  if (decision.allowed) {
    return;
  }

  const matched = decision.matchedView
    ? `; matchedView=${decision.matchedView}`
    : decision.matchedJob
      ? `; matchedJob=${decision.matchedJob}`
      : "";

  throw new Error(
    `Jenkins protected tool rejected: ${decision.toolName} for ${decision.jobPath}; reason=${decision.reason}${matched}`
  );
}

async function viewContainsJob(
  viewName: string,
  normalizedJobPath: string,
  listJobsInView: (viewName: string) => Promise<JenkinsJobList>
): Promise<boolean> {
  const viewJobs = await listJobsInView(viewName);
  return viewJobs.jobs.some((job) => {
    const jobName = typeof job.fullName === "string" ? job.fullName : typeof job.name === "string" ? job.name : undefined;
    return jobName ? normalizeJobPath(jobName) === normalizedJobPath : false;
  });
}

function allow(
  reason: ProtectedToolDecisionReason,
  toolName: string,
  jobPath: string,
  extra: Partial<ProtectedToolDecision> = {}
): ProtectedToolDecision {
  return {
    allowed: true,
    reason,
    toolName,
    jobPath,
    ...extra
  };
}

function deny(
  reason: ProtectedToolDecisionReason,
  toolName: string,
  jobPath: string,
  extra: Partial<ProtectedToolDecision> = {}
): ProtectedToolDecision {
  return {
    allowed: false,
    reason,
    toolName,
    jobPath,
    ...extra
  };
}
