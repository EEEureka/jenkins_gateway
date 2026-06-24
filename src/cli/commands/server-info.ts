import type { Writable } from "node:stream";

import { createCliContext } from "../context.js";
import { toJson } from "../output.js";

export async function runServerInfo(env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.getServerInfo(), [config.apiToken]));
}
