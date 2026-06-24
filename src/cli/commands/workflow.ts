import type { Writable } from "node:stream";

import { upgradeComponentWorkflow } from "../../core/workflows.js";
import { createCliContext } from "../context.js";
import { CliUsageError, readOption, removeFlag, requireNoArgs } from "../options.js";
import { toJson } from "../output.js";

export async function runWorkflowCommand(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const command = args.shift();
  if (command === "upgrade-component") {
    await runUpgradeComponent(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected workflow command: upgrade-component");
}

async function runUpgradeComponent(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const wait = removeFlag(args, "--wait");
  const compileJob = readRequiredOption(args, "--compile-job");
  const upgradeJob = readRequiredOption(args, "--upgrade-job");
  const component = readRequiredOption(args, "--component");
  const parameterName = readOption(args, "--parameter") ?? readOption(args, "--parameter-name") ?? "serviceList";
  const compileBuild = readOption(args, "--compile-build");
  const timeoutSeconds = readOption(args, "--timeout-seconds");
  const intervalSeconds = readOption(args, "--interval-seconds");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  const result = await upgradeComponentWorkflow(client, {
    compileJob,
    upgradeJob,
    component,
    parameterName,
    compileBuild,
    wait,
    timeoutMs: timeoutSeconds ? Number(timeoutSeconds) * 1_000 : undefined,
    intervalMs: intervalSeconds ? Number(intervalSeconds) * 1_000 : undefined
  });

  stdout.write(toJson(result, [config.apiToken]));
}

function readRequiredOption(args: string[], name: string): string {
  const value = readOption(args, name);
  if (!value) {
    throw new CliUsageError(`${name} is required`);
  }
  return value;
}
