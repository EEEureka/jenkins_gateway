import type { Writable } from "node:stream";

import { createCliContext } from "../context.js";
import {
  CliUsageError,
  mergeParameters,
  parseParameterEntries,
  parseParameterJson,
  readOption,
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

  if (command === "get") {
    await runBuildGet(args, env, stdout);
    return;
  }

  if (command === "wait") {
    await runBuildWait(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected build command: trigger, get, or wait");
}

async function runBuildTrigger(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const jobPath = requirePositional(args.shift(), "jobPath");
  const parameters = mergeParameters(
    parseParameterEntries(readRepeatedOption(args, "--param")),
    parseParameterJson(readOption(args, "--param-json"))
  );
  const submitMode = readOption(args, "--submit-mode") ?? "auto";
  if (submitMode !== "auto" && submitMode !== "urlencoded" && submitMode !== "jenkins-form") {
    throw new CliUsageError("--submit-mode must be auto, urlencoded, or jenkins-form");
  }
  const verifyParameters = removeFlag(args, "--verify-parameters");
  const noVerifyParameters = removeFlag(args, "--no-verify-parameters");
  if (verifyParameters && noVerifyParameters) {
    throw new CliUsageError("Use either --verify-parameters or --no-verify-parameters, not both");
  }
  const waitForStart = removeFlag(args, "--wait-queue") || (verifyParameters && !noVerifyParameters);
  const timeoutMs = readSecondsOption(args, "--timeout-seconds");
  const intervalMs = readSecondsOption(args, "--interval-seconds");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(
    toJson(
      await client.triggerBuild(jobPath, parameters, {
        submitMode,
        waitForStart,
        verifyParameters: verifyParameters && !noVerifyParameters,
        timeoutMs,
        intervalMs
      }),
      [config.apiToken]
    )
  );
}

async function runBuildGet(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const jobPath = requirePositional(args.shift(), "jobPath");
  const build = requirePositional(args.shift(), "build");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.getBuild(jobPath, parseBuildRef(build)), [config.apiToken]));
}

async function runBuildWait(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const jobPath = requirePositional(args.shift(), "jobPath");
  const build = requirePositional(args.shift(), "build");
  const timeoutMs = readSecondsOption(args, "--timeout-seconds");
  const intervalMs = readSecondsOption(args, "--interval-seconds");
  requireNoArgs(args);

  const { config, client } = createCliContext(env);
  stdout.write(toJson(await client.waitForBuild(jobPath, parseBuildRef(build), { timeoutMs, intervalMs }), [config.apiToken]));
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

function parseBuildRef(value: string): number | string {
  return /^\d+$/.test(value) ? Number(value) : value;
}
