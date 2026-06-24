#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { JenkinsClient } from "./jenkins/client.js";
import { createServer, runStdioServer } from "./server.js";

try {
  const config = loadConfig();
  await runStdioServer(createServer({ config, client: new JenkinsClient(config) }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`jenkins-gateway-mcp failed to start: ${message}`);
  process.exitCode = 1;
}
