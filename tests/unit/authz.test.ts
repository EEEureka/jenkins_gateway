import { describe, expect, it } from "vitest";

import { explainProtectedToolDecision, type JenkinsGatewayConfig, type JenkinsJobList } from "../../src/core/index.js";

const baseConfig: JenkinsGatewayConfig = {
  profile: "test",
  baseUrl: new URL("https://jenkins.example.com/"),
  userId: "alice",
  apiToken: "secret",
  enableProtectedTools: true,
  protectedAllowAll: false,
  protectedViewAllowlist: [],
  protectedViewDenylist: [],
  protectedJobAllowlist: [],
  protectedJobDenylist: [],
  requestTimeoutMs: 30_000,
  consoleLogMaxBytes: 65_536,
  logLevel: "info"
};

describe("explainProtectedToolDecision", () => {
  it("denies protected tools by default", async () => {
    const decision = await explainProtectedToolDecision({
      config: {
        ...baseConfig,
        enableProtectedTools: false
      },
      toolName: "jenkins.trigger_build",
      jobPath: "folder/job",
      listJobsInView
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "protected-tools-disabled"
    });
  });

  it("uses job-level rules before view and all rules", async () => {
    const decision = await explainProtectedToolDecision({
      config: {
        ...baseConfig,
        protectedAllowAll: true,
        protectedViewDenylist: ["release"],
        protectedJobAllowlist: ["folder/job"]
      },
      toolName: "jenkins.trigger_build",
      jobPath: "folder/job",
      listJobsInView
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "matched-protected-job-allowlist"
    });
  });

  it("uses view deny before view allow at the same level", async () => {
    const decision = await explainProtectedToolDecision({
      config: {
        ...baseConfig,
        protectedViewAllowlist: ["release"],
        protectedViewDenylist: ["release"]
      },
      toolName: "jenkins.trigger_build",
      jobPath: "folder/job",
      listJobsInView
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "matched-protected-view-denylist",
      matchedView: "release"
    });
  });
});

async function listJobsInView(viewName: string): Promise<JenkinsJobList> {
  return {
    viewName,
    jobs:
      viewName === "release"
        ? [
            {
              fullName: "folder/job"
            }
          ]
        : []
  };
}
