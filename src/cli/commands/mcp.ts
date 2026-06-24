import { createServer, runStdioServer } from "../../mcp/server.js";
import { createCliContext } from "../context.js";

export async function runMcpStdio(env: NodeJS.ProcessEnv): Promise<void> {
  const { config, client } = createCliContext(env);
  await runStdioServer(createServer({ config, client }));
}
