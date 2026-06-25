import { fileURLToPath } from "node:url";
import type { Writable } from "node:stream";

import {
  installBundledSkill,
  isSkillInstallPlatform,
  isSkillInstallScope,
  listBundledSkills,
  type SkillInstallPlatform,
  type SkillInstallScope
} from "../../core/skill-installer.js";
import { CliUsageError, readOption, removeFlag, requireNoArgs, requirePositional } from "../options.js";
import { toJson } from "../output.js";

export async function runSkillCommand(args: string[], stdout: Writable): Promise<void> {
  const command = args.shift();
  if (command === "install") {
    await runSkillInstall(args, stdout);
    return;
  }

  if (command === "list") {
    await runSkillList(args, stdout);
    return;
  }

  throw new CliUsageError("Expected skill command: install or list");
}

async function runSkillInstall(args: string[], stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  const force = removeFlag(args, "--force");
  const dryRun = removeFlag(args, "--dry-run");
  const platform = parsePlatform(readOption(args, "--platform") ?? "codex");
  const scope = parseScope(readOption(args, "--scope") ?? "project");
  const targetRoot = readOption(args, "--target");
  const skillName = requirePositional(args.shift(), "skillName");
  requireNoArgs(args);

  const result = await installBundledSkill({
    packageRoot: getPackageRoot(),
    skillName,
    platform,
    scope,
    targetRoot,
    force,
    dryRun
  });
  stdout.write(toJson(result));
}

async function runSkillList(args: string[], stdout: Writable): Promise<void> {
  removeFlag(args, "--json");
  requireNoArgs(args);

  stdout.write(
    toJson({
      skills: await listBundledSkills(getPackageRoot())
    })
  );
}

function parsePlatform(value: string): SkillInstallPlatform {
  if (!isSkillInstallPlatform(value)) {
    throw new CliUsageError("Unsupported --platform. Expected one of: codex, claude, cursor, vscode");
  }
  return value;
}

function parseScope(value: string): SkillInstallScope {
  if (!isSkillInstallScope(value)) {
    throw new CliUsageError("Unsupported --scope. Expected one of: project, user");
  }
  return value;
}

function getPackageRoot(): string {
  return fileURLToPath(new URL("../../../", import.meta.url));
}
