import type { Writable } from "node:stream";

import { createCliContext } from "../context.js";
import { CliUsageError, removeFlag, requireNoArgs, requirePositional } from "../options.js";
import { toJson } from "../output.js";

export async function runViewCommand(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const command = args.shift();
  if (command === "list") {
    await runViewList(args, env, stdout);
    return;
  }

  if (command === "get") {
    await runViewGet(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected view command: list or get");
}

async function runViewList(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.listViews(), [config.apiToken]));
}

async function runViewGet(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const viewName = requirePositional(args.shift(), "viewName");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.getView(viewName), [config.apiToken]));
}
