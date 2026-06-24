import { spawn } from "node:child_process";
import { once } from "node:events";
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
});
