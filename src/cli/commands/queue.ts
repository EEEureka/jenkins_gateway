import type { Writable } from "node:stream";

import { createCliContext } from "../context.js";
import { CliUsageError, readOption, removeFlag, requireNoArgs, requirePositional } from "../options.js";
import { toJson } from "../output.js";

export async function runQueueCommand(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const command = args.shift();
  if (command === "get") {
    await runQueueGet(args, env, stdout);
    return;
  }

  if (command === "wait") {
    await runQueueWait(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected queue command: get or wait");
}

async function runQueueGet(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const queueId = parseQueueId(requirePositional(args.shift(), "queueId"));
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.getQueueItem(queueId), [config.apiToken]));
}

async function runQueueWait(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const queueId = parseQueueId(requirePositional(args.shift(), "queueId"));
  const timeoutMs = readSecondsOption(args, "--timeout-seconds");
  const intervalMs = readSecondsOption(args, "--interval-seconds");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.waitForQueueItem(queueId, { timeoutMs, intervalMs }), [config.apiToken]));
}

function parseQueueId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CliUsageError("queueId must be a positive integer");
  }

  const queueId = Number(value);
  if (!Number.isSafeInteger(queueId) || queueId <= 0) {
    throw new CliUsageError("queueId must be a positive integer");
  }

  return queueId;
}

function readSecondsOption(args: string[], name: string): number | undefined {
  const value = readOption(args, name);
  if (value === undefined) {
    return undefined;
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new CliUsageError(`${name} must be a positive number`);
  }

  return Math.ceil(seconds * 1000);
}
