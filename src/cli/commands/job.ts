import type { Writable } from "node:stream";

import { createCliContext } from "../context.js";
import { CliUsageError, readOption, removeFlag, requireNoArgs, requirePositional } from "../options.js";
import { toJson } from "../output.js";

export async function runJobCommand(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const command = args.shift();
  if (command === "list") {
    await runJobList(args, env, stdout);
    return;
  }

  if (command === "get") {
    await runJobGet(args, env, stdout);
    return;
  }

  if (command === "params") {
    await runJobParams(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected job command: list, get, or params");
}

async function runJobList(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const folderPath = readOption(args, "--folder") ?? readOption(args, "--folderPath");
  const viewName = readOption(args, "--view");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  if (folderPath && viewName) {
    throw new CliUsageError("job list accepts either --folder or --view, not both");
  }

  const result = viewName ? await client.listJobsInView(viewName) : await client.listJobs(folderPath);
  stdout.write(toJson(result, [config.apiToken]));
}

async function runJobGet(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const jobPath = requirePositional(args.shift(), "jobPath");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.getJob(jobPath), [config.apiToken]));
}

async function runJobParams(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const jobPath = requirePositional(args.shift(), "jobPath");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.getBuildParameters(jobPath), [config.apiToken]));
}
