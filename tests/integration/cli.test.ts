import { spawn } from "node:child_process";
import { once } from "node:events";
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
          choices: ["MACC-FRONT-RELEASE", "OCE-RELEASE"]
        }
      ]
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
  envOverrides: Record<string, string>
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, ["dist/cli.js", ...args], {
    cwd: process.cwd(),
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
