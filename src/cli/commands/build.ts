import type { Writable } from "node:stream";

import { createCliContext } from "../context.js";
import {
  CliUsageError,
  parseParameterEntries,
  readRepeatedOption,
  removeFlag,
  requireNoArgs,
  requirePositional
} from "../options.js";
import { toJson } from "../output.js";

export async function runBuildCommand(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const command = args.shift();
  if (command === "trigger") {
    await runBuildTrigger(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected build command: trigger");
}

async function runBuildTrigger(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const jobPath = requirePositional(args.shift(), "jobPath");
  const parameters = parseParameterEntries(readRepeatedOption(args, "--param"));
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.triggerBuild(jobPath, parameters), [config.apiToken]));
}
