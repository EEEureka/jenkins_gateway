import type { Writable } from "node:stream";

import { runBuildCommand } from "./commands/build.js";
import { runJobCommand } from "./commands/job.js";
import { runMcpStdio } from "./commands/mcp.js";
import { runQueueCommand } from "./commands/queue.js";
import { runServerInfo } from "./commands/server-info.js";
import { runSkillCommand } from "./commands/skill.js";
import { runViewCommand } from "./commands/view.js";
import { runWorkflowCommand } from "./commands/workflow.js";
import { CliUsageError, removeFlag, requireNoArgs } from "./options.js";

export interface RunCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: Writable;
  stderr?: Writable;
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const argv = [...(options.argv ?? process.argv.slice(2))];
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  try {
    await dispatch(argv, env, stdout);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = error instanceof CliUsageError ? "usage error" : "jenkins-gateway failed";
    stderr.write(`${prefix}: ${message}\n`);
    return 1;
  }
}

async function dispatch(args: string[], env: NodeJS.ProcessEnv, stdout: Writable): Promise<void> {
  const group = args.shift();

  if (!group) {
    await runMcpStdio(env);
    return;
  }

  if (group === "mcp") {
    const transport = args.shift() ?? "stdio";
    if (transport !== "stdio") {
      throw new CliUsageError("Expected MCP transport: stdio");
    }
    requireNoArgs(args);
    await runMcpStdio(env);
    return;
  }

  if (group === "server") {
    const command = args.shift();
    if (command !== "info") {
      throw new CliUsageError("Expected server command: info");
    }
    removeFlag(args, "--json");
    requireNoArgs(args);
    await runServerInfo(env, stdout);
    return;
  }

  if (group === "job") {
    await runJobCommand(args, env, stdout);
    return;
  }

  if (group === "view") {
    await runViewCommand(args, env, stdout);
    return;
  }

  if (group === "build") {
    await runBuildCommand(args, env, stdout);
    return;
  }

  if (group === "queue") {
    await runQueueCommand(args, env, stdout);
    return;
  }

  if (group === "skill") {
    await runSkillCommand(args, stdout);
    return;
  }

  if (group === "workflow") {
    await runWorkflowCommand(args, env, stdout);
    return;
  }

  throw new CliUsageError("Expected command group: mcp, server, job, view, build, queue, skill, or workflow");
}
