import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";
import { JenkinsClient } from "../../src/jenkins/client.js";
import { createServer } from "../../src/server.js";
import { startMockJenkins, type MockJenkins } from "./helpers/mock-jenkins.js";

let mockJenkins: MockJenkins | undefined;

afterEach(async () => {
  await mockJenkins?.close();
  mockJenkins = undefined;
});

describe("jenkins.get_server_info", () => {
  it("probes Jenkins through MCP without exposing the API token", async () => {
    mockJenkins = await startMockJenkins();
    const config = loadConfig({
      JENKINS_MCP_PROFILE: "integration",
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret"
    });

    const server = createServer({
      config,
      client: new JenkinsClient(config)
    });
    const client = new Client({
      name: "integration-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("jenkins.get_server_info");

      const result = await client.callTool({
        name: "jenkins.get_server_info",
        arguments: {}
      });

      const content = "content" in result && Array.isArray(result.content) ? result.content : [];
      expect(content[0]).toMatchObject({
        type: "text"
      });
      expect(JSON.stringify(result)).not.toContain("super-secret");
      expect(result.structuredContent).toMatchObject({
        baseUrl: mockJenkins.baseUrl,
        profile: "integration",
        reachable: true,
        version: "2.492.1",
        user: {
          id: "alice",
          authenticated: true
        }
      });

      const expectedAuth = `Basic ${Buffer.from("alice:super-secret", "utf8").toString("base64")}`;
      expect(mockJenkins.requests.every((request) => request.authorization === expectedAuth)).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("read-only Jenkins tools", () => {
  it("lists jobs, views and reads job, build, parameters, and queue state", async () => {
    mockJenkins = await startMockJenkins();
    const config = loadConfig({
      JENKINS_MCP_PROFILE: "integration",
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret"
    });

    const server = createServer({
      config,
      client: new JenkinsClient(config)
    });
    const client = new Client({
      name: "integration-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "jenkins.list_jobs",
          "jenkins.get_job",
          "jenkins.list_views",
          "jenkins.get_view",
          "jenkins.get_build_parameters",
          "jenkins.get_build",
          "jenkins.get_queue_item"
        ])
      );

      await expect(
        client.callTool({
          name: "jenkins.list_jobs",
          arguments: {
            folderPath: "folder a"
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          jobs: [
            {
              fullName: "folder a/build-app"
            }
          ]
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.get_job",
          arguments: {
            jobPath: "folder a/build-app"
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          fullName: "folder a/build-app",
          buildable: true
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.get_build",
          arguments: {
            jobPath: "folder a/build-app",
            build: 42
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          number: 42,
          result: "SUCCESS"
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.list_views",
          arguments: {}
        })
      ).resolves.toMatchObject({
        structuredContent: {
          views: [
            {
              name: "release"
            }
          ]
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.get_view",
          arguments: {
            viewName: "release"
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          name: "release",
          jobs: [
            {
              fullName: "folder a/build-app"
            },
            {
              fullName: "upgrade/deploy"
            }
          ]
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.get_build_parameters",
          arguments: {
            jobPath: "upgrade/deploy"
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          parameters: [
            {
              name: "serviceList",
              choices: ["MACC-FRONT-RELEASE", "OCE-RELEASE"],
              source: "build-page-html"
            }
          ]
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.get_queue_item",
          arguments: {
            queueId: 100
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          id: 100,
          buildable: true
        }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("protected Jenkins tools", () => {
  it("rejects protected tools by default", async () => {
    mockJenkins = await startMockJenkins();
    const config = loadConfig({
      JENKINS_MCP_PROFILE: "integration",
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret"
    });

    const server = createServer({
      config,
      client: new JenkinsClient(config)
    });
    const client = new Client({
      name: "integration-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const triggerResult = await client.callTool({
        name: "jenkins.trigger_build",
        arguments: {
          jobPath: "folder a/build-app"
        }
      });

      const logResult = await client.callTool({
        name: "jenkins.get_console_log",
        arguments: {
          jobPath: "folder a/build-app",
          build: 42
        }
      });

      expect(triggerResult).toMatchObject({
        isError: true
      });
      expect(logResult).toMatchObject({
        isError: true
      });
      expect(mockJenkins.requests.some((request) => request.method === "POST")).toBe(false);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("reads logs, triggers and stops builds only when protected rules permit it", async () => {
    mockJenkins = await startMockJenkins();
    const config = loadConfig({
      JENKINS_MCP_PROFILE: "integration",
      JENKINS_BASE_URL: mockJenkins.baseUrl,
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "super-secret",
      JENKINS_MCP_ENABLE_PROTECTED_TOOLS: "true",
      JENKINS_MCP_PROTECTED_JOB_ALLOWLIST: "folder a/build-app",
      JENKINS_MCP_CONSOLE_LOG_MAX_BYTES: "8"
    });

    const server = createServer({
      config,
      client: new JenkinsClient(config)
    });
    const client = new Client({
      name: "integration-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      await expect(
        client.callTool({
          name: "jenkins.get_console_log",
          arguments: {
            jobPath: "folder a/build-app",
            build: 42
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          text: "line 1\ns",
          nextStart: 64,
          truncated: true
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.get_console_log",
          arguments: {
            jobPath: "folder a/build-app",
            build: 42,
            maxBytes: 64
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          text: expect.stringContaining("super-secret"),
          truncated: false
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.trigger_build",
          arguments: {
            jobPath: "folder a/build-app",
            parameters: {
              branch: "main",
              dryRun: true
            }
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          jobPath: "folder a/build-app",
          queued: true,
          queueUrl: "/queue/item/101/",
          queueId: 101
        }
      });

      await expect(
        client.callTool({
          name: "jenkins.stop_build",
          arguments: {
            jobPath: "folder a/build-app",
            build: 42
          }
        })
      ).resolves.toMatchObject({
        structuredContent: {
          jobPath: "folder a/build-app",
          build: 42,
          stopped: true
        }
      });

      const posts = mockJenkins.requests.filter((request) => request.method === "POST");
      expect(posts).toHaveLength(2);
      expect(posts.every((request) => request.crumb === "crumb-value")).toBe(true);
      expect(posts[0]?.body).toBe("branch=main&dryRun=true");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
