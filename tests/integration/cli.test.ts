import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { startMockJenkins, type MockJenkins } from "./helpers/mock-jenkins.js";

let mockJenkins: MockJenkins | undefined;

afterEach(async () => {
  await mockJenkins?.close();
  mockJenkins = undefined;
});

describe("cli", () => {
  it("starts the stdio MCP server without writing logs to stdout", async () => {
    mockJenkins = await startMockJenkins();
    const child = spawn(process.execPath, ["dist/cli.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        JENKINS_BASE_URL: mockJenkins.baseUrl,
        JENKINS_USER_ID: "alice",
        JENKINS_API_TOKEN: "super-secret"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(child.exitCode).toBeNull();
      child.stdin.end();

      await once(child, "exit");
      expect(child.stdout.read()?.toString() ?? "").toBe("");
    } finally {
      if (!child.killed && child.exitCode === null) {
        child.kill();
      }
    }
  });

  it("prints server info as JSON without exposing the API token", async () => {
    mockJenkins = await startMockJenkins();

    const result = await runCli(["server", "info", "--json"], {
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret"
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("super-secret");
    expect(JSON.parse(result.stdout)).toMatchObject({
      baseUrl: mockJenkins.baseUrl,
      profile: "default",
      reachable: true,
      version: "2.492.1"
    });
  });

  it("lists views and reads jobs and parameters as JSON", async () => {
    mockJenkins = await startMockJenkins();

    const env = {
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret"
    };

    const listResult = await runCli(["job", "list", "--folder", "folder a", "--json"], env);
    expect(listResult.code).toBe(0);
    expect(JSON.parse(listResult.stdout)).toMatchObject({
      folderPath: "folder a",
      jobs: [
        {
          fullName: "folder a/build-app"
        }
      ]
    });

    const getResult = await runCli(["job", "get", "folder a/build-app", "--json"], env);
    expect(getResult.code).toBe(0);
    expect(JSON.parse(getResult.stdout)).toMatchObject({
      fullName: "folder a/build-app",
      buildable: true
    });

    const viewResult = await runCli(["view", "get", "release", "--json"], env);
    expect(viewResult.code).toBe(0);
    expect(JSON.parse(viewResult.stdout)).toMatchObject({
      name: "release",
      jobs: [
        {
          fullName: "folder a/build-app"
        },
        {
          fullName: "upgrade/deploy"
        }
      ]
    });

    const viewJobsResult = await runCli(["job", "list", "--view", "release", "--json"], env);
    expect(viewJobsResult.code).toBe(0);
    expect(JSON.parse(viewJobsResult.stdout)).toMatchObject({
      viewName: "release",
      jobs: [
        {
          fullName: "folder a/build-app"
        },
        {
          fullName: "upgrade/deploy"
        }
      ]
    });

    const paramsResult = await runCli(["job", "params", "upgrade/deploy", "--json"], env);
    expect(paramsResult.code).toBe(0);
    expect(JSON.parse(paramsResult.stdout)).toMatchObject({
      jobPath: "upgrade/deploy",
      parameters: [
        {
          name: "serviceList",
          kind: "extended-choice-checkbox",
          choices: ["MACC-FRONT-RELEASE", "OCE-RELEASE"]
        }
      ]
    });
  });

  it("reads build and queue state as JSON", async () => {
    mockJenkins = await startMockJenkins();

    const env = {
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret"
    };

    const buildResult = await runCli(["build", "get", "upgrade/deploy", "7", "--json"], env);
    expect(buildResult.code).toBe(0);
    expect(JSON.parse(buildResult.stdout)).toMatchObject({
      number: 7,
      result: "SUCCESS",
      actions: [
        {
          parameters: [
            {
              name: "serviceList",
              value: "MACC-FRONT-RELEASE"
            }
          ]
        }
      ]
    });

    const queueResult = await runCli(["queue", "get", "201", "--json"], env);
    expect(queueResult.code).toBe(0);
    expect(JSON.parse(queueResult.stdout)).toMatchObject({
      id: 201,
      executable: {
        number: 7
      }
    });

    const queueWaitResult = await runCli(["queue", "wait", "201", "--interval-seconds", "0.01", "--json"], env);
    expect(queueWaitResult.code).toBe(0);
    expect(JSON.parse(queueWaitResult.stdout)).toMatchObject({
      queueId: 201,
      executable: {
        number: 7
      }
    });
  });

  it("triggers builds as JSON when protected settings permit it", async () => {
    mockJenkins = await startMockJenkins();

    const result = await runCli(["build", "trigger", "folder a/build-app", "--param", "branch=main", "--json"], {
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret",
      JENKINS_MCP_ENABLE_PROTECTED_TOOLS: "true",
      JENKINS_MCP_PROTECTED_JOB_ALLOWLIST: "folder a/build-app"
    });

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      jobPath: "folder a/build-app",
      queued: true,
      queueId: 101
    });
    expect(mockJenkins.requests.filter((request) => request.method === "POST")).toHaveLength(1);
    expect(mockJenkins.requests.find((request) => request.method === "POST")?.body).toBe("branch=main");
  });

  it("verifies parameterized build trigger values after queue execution starts", async () => {
    mockJenkins = await startMockJenkins();

    const result = await runCli(
      [
        "build",
        "trigger",
        "upgrade/deploy",
        "--param",
        "serviceList=MACC-FRONT-RELEASE",
        "--verify-parameters",
        "--interval-seconds",
        "0.01",
        "--json"
      ],
      {
        JENKINS_BASE_URL: mockJenkins.baseUrl,
        JENKINS_USER_ID: "alice",
        JENKINS_API_TOKEN: "super-secret",
        JENKINS_MCP_ENABLE_PROTECTED_TOOLS: "true",
        JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST: "release"
      }
    );

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      jobPath: "upgrade/deploy",
      queued: true,
      submitMode: "jenkins-form",
      queueId: 201,
      buildNumber: 7,
      parameterVerification: {
        ok: true
      }
    });

    const buildRequest = mockJenkins.requests.find(
      (request) => request.method === "POST" && request.url === "/job/upgrade/job/deploy/build"
    );
    expect(buildRequest?.body).toContain("json=");
    expect(buildRequest?.body).toContain("MACC-FRONT-RELEASE");
  });

  it("fails verification when Jenkins accepts the queue item but drops a parameter", async () => {
    mockJenkins = await startMockJenkins();

    const result = await runCli(
      [
        "build",
        "trigger",
        "upgrade/deploy",
        "--submit-mode",
        "urlencoded",
        "--param",
        "serviceList=MACC-FRONT-RELEASE",
        "--verify-parameters",
        "--interval-seconds",
        "0.01",
        "--json"
      ],
      {
        JENKINS_BASE_URL: mockJenkins.baseUrl,
        JENKINS_USER_ID: "alice",
        JENKINS_API_TOKEN: "super-secret",
        JENKINS_MCP_ENABLE_PROTECTED_TOOLS: "true",
        JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST: "release"
      }
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Jenkins build parameter verification failed");
    expect(result.stderr).toContain("serviceList expected=MACC-FRONT-RELEASE actual=<empty>");
  });

  it("installs the bundled workflow skill without Jenkins credentials", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "jenkins-gateway-cli-"));

    try {
      const result = await runCli(
        ["skill", "install", "jenkins-workflow", "--platform", "codex", "--scope", "project", "--json"],
        {},
        workspaceRoot
      );

      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toMatchObject({
        skillName: "jenkins-workflow",
        platform: "codex",
        scope: "project",
        installed: true
      });
      await expect(readFile(path.join(workspaceRoot, ".agents", "skills", "jenkins-workflow", "SKILL.md"), "utf8")).resolves.toContain(
        "name: jenkins-workflow"
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("runs the upgrade-component workflow as JSON", async () => {
    mockJenkins = await startMockJenkins();

    const result = await runCli(
      [
        "workflow",
        "upgrade-component",
        "--compile-job",
        "folder a/build-app",
        "--compile-build",
        "42",
        "--upgrade-job",
        "upgrade/deploy",
        "--component",
        "MACC-FRONT-RELEASE",
        "--wait",
        "--interval-seconds",
        "0.01",
        "--timeout-seconds",
        "5",
        "--json"
      ],
      {
        JENKINS_BASE_URL: mockJenkins.baseUrl,
        JENKINS_USER_ID: "alice",
        JENKINS_API_TOKEN: "super-secret",
        JENKINS_MCP_ENABLE_PROTECTED_TOOLS: "true",
        JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST: "release"
      }
    );

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      workflow: "upgrade-component",
      compile: {
        jobPath: "folder a/build-app",
        result: "SUCCESS"
      },
      upgrade: {
        jobPath: "upgrade/deploy",
        component: "MACC-FRONT-RELEASE",
        queueId: 201,
        buildNumber: 7,
        build: {
          result: "SUCCESS"
        }
      }
    });
  });
});

async function runCli(
  args: string[],
  envOverrides: Record<string, string>,
  cwd = process.cwd()
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist", "cli.js"), ...args], {
    cwd,
    env: {
      ...process.env,
      ...envOverrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const [code, stdout, stderr] = await Promise.all([once(child, "exit"), readStream(child.stdout), readStream(child.stderr)]);

  return {
    code: code[0] as number | null,
    stdout,
    stderr
  };
}

async function readStream(stream: ChildProcessWithoutNullStreams["stdout"]): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
