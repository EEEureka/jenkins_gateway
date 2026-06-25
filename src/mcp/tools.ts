import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { JenkinsClient } from "../core/jenkins-client.js";
import { redactObject } from "../core/redaction.js";

export interface ToolContext {
  client: JenkinsClient;
  secrets?: string[];
}

export function registerJenkinsTools(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "jenkins.get_server_info",
    {
      title: "Get Jenkins server info",
      description: "Probe Jenkins connectivity and return basic server and authenticated user information.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async () => {
      const info = redactObject(await context.client.getServerInfo(), context.secrets);
      const structuredContent = info as unknown as Record<string, unknown>;
      const text = JSON.stringify(info, null, 2);

      return {
        content: [
          {
            type: "text",
            text
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "jenkins.list_jobs",
    {
      title: "List Jenkins jobs",
      description: "List jobs at the Jenkins root or under a folder job.",
      inputSchema: {
        folderPath: z.string().optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ folderPath }) => toToolResult(await context.client.listJobs(folderPath), context.secrets)
  );

  server.registerTool(
    "jenkins.get_job",
    {
      title: "Get Jenkins job",
      description: "Get Jenkins job metadata, parameter definitions, and recent build pointers.",
      inputSchema: {
        jobPath: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ jobPath }) => toToolResult(await context.client.getJob(jobPath), context.secrets)
  );

  server.registerTool(
    "jenkins.list_views",
    {
      title: "List Jenkins views",
      description: "List Jenkins views visible to the configured Jenkins account.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async () => toToolResult(await context.client.listViews(), context.secrets)
  );

  server.registerTool(
    "jenkins.get_view",
    {
      title: "Get Jenkins view",
      description: "Get Jenkins view metadata and jobs.",
      inputSchema: {
        viewName: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ viewName }) => toToolResult(await context.client.getView(viewName), context.secrets)
  );

  server.registerTool(
    "jenkins.get_build_parameters",
    {
      title: "Get Jenkins build parameters",
      description: "Get build parameter definitions and known choices for a Jenkins job.",
      inputSchema: {
        jobPath: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ jobPath }) => toToolResult(await context.client.getBuildParameters(jobPath), context.secrets)
  );

  server.registerTool(
    "jenkins.get_build",
    {
      title: "Get Jenkins build",
      description: "Get Jenkins build status and metadata.",
      inputSchema: {
        jobPath: z.string().min(1),
        build: z.union([z.number().int().positive(), z.string().min(1)]).default("lastBuild")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ jobPath, build }) => toToolResult(await context.client.getBuild(jobPath, build), context.secrets)
  );

  server.registerTool(
    "jenkins.get_console_log",
    {
      title: "Get Jenkins console log",
      description: "Read a page of Jenkins progressive console output.",
      inputSchema: {
        jobPath: z.string().min(1),
        build: z.union([z.number().int().positive(), z.string().min(1)]).default("lastBuild"),
        start: z.number().int().nonnegative().default(0),
        maxBytes: z.number().int().positive().optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ jobPath, build, start, maxBytes }) =>
      toToolResult(await context.client.getConsoleLog(jobPath, build, { start, maxBytes }))
  );

  server.registerTool(
    "jenkins.get_queue_item",
    {
      title: "Get Jenkins queue item",
      description: "Get Jenkins queue item state by queue id.",
      inputSchema: {
        queueId: z.number().int().positive()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ queueId }) => toToolResult(await context.client.getQueueItem(queueId), context.secrets)
  );

  server.registerTool(
    "jenkins.trigger_build",
    {
      title: "Trigger Jenkins build",
      description: "Trigger a Jenkins build. Disabled unless protected-tool settings permit it.",
      inputSchema: {
        jobPath: z.string().min(1),
        parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
        submitMode: z.enum(["auto", "urlencoded", "jenkins-form"]).default("auto"),
        waitForStart: z.boolean().default(false),
        verifyParameters: z.boolean().default(false),
        timeoutSeconds: z.number().positive().optional(),
        intervalSeconds: z.number().positive().optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ jobPath, parameters, submitMode, waitForStart, verifyParameters, timeoutSeconds, intervalSeconds }) =>
      toToolResult(
        await context.client.triggerBuild(jobPath, parameters, {
          submitMode,
          waitForStart: waitForStart || verifyParameters,
          verifyParameters,
          timeoutMs: timeoutSeconds === undefined ? undefined : Math.ceil(timeoutSeconds * 1000),
          intervalMs: intervalSeconds === undefined ? undefined : Math.ceil(intervalSeconds * 1000)
        }),
        context.secrets
      )
  );

  server.registerTool(
    "jenkins.stop_build",
    {
      title: "Stop Jenkins build",
      description: "Stop a Jenkins build. Disabled unless protected-tool settings permit it.",
      inputSchema: {
        jobPath: z.string().min(1),
        build: z.union([z.number().int().positive(), z.string().min(1)])
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ jobPath, build }) => toToolResult(await context.client.stopBuild(jobPath, build), context.secrets)
  );
}

function toToolResult(value: unknown, secrets: string[] = []) {
  const safeValue = redactObject(value, secrets) as Record<string, unknown>;
  const text = JSON.stringify(safeValue, null, 2);

  return {
    content: [
      {
        type: "text" as const,
        text
      }
    ],
    structuredContent: safeValue
  };
}
