import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { JenkinsGatewayConfig } from "../core/config.js";
import { JenkinsClient } from "../core/jenkins-client.js";
import { registerJenkinsTools } from "./tools.js";

export interface ServerOptions {
  name?: string;
  version?: string;
  config?: JenkinsGatewayConfig;
  client?: JenkinsClient;
}

export function createServer(options: ServerOptions = {}): McpServer {
  const server = new McpServer({
    name: options.name ?? "jenkins-gateway-mcp",
    version: options.version ?? "0.1.0"
  });

  if (options.config || options.client) {
    const client = options.client ?? new JenkinsClient(options.config!);
    registerJenkinsTools(server, {
      client,
      secrets: options.config ? [options.config.apiToken] : []
    });
  }

  return server;
}

export async function runStdioServer(server = createServer()): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
