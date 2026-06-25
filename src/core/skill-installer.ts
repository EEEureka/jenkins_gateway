import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export const SKILL_INSTALL_PLATFORMS = ["codex", "claude", "cursor", "vscode"] as const;
export const SKILL_INSTALL_SCOPES = ["project", "user"] as const;

export type SkillInstallPlatform = (typeof SKILL_INSTALL_PLATFORMS)[number];
export type SkillInstallScope = (typeof SKILL_INSTALL_SCOPES)[number];

export interface BundledSkill {
  name: string;
  sourceDir: string;
}

export interface SkillInstallOptions {
  packageRoot: string;
  skillName?: string;
  platform?: SkillInstallPlatform;
  scope?: SkillInstallScope;
  cwd?: string;
  homeDir?: string;
  targetRoot?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface SkillInstallResult {
  skillName: string;
  platform: SkillInstallPlatform;
  scope: SkillInstallScope;
  sourceDir: string;
  targetRoot: string;
  targetDir: string;
  installed: boolean;
  overwritten: boolean;
  dryRun: boolean;
}

export class SkillInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillInstallError";
  }
}

const DEFAULT_SKILL_NAME = "jenkins-workflow";

export async function listBundledSkills(packageRoot: string): Promise<BundledSkill[]> {
  const skillsRoot = path.resolve(packageRoot, "skills");
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skills: BundledSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourceDir = path.join(skillsRoot, entry.name);
    if (await pathExists(path.join(sourceDir, "SKILL.md"))) {
      skills.push({
        name: entry.name,
        sourceDir
      });
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export async function installBundledSkill(options: SkillInstallOptions): Promise<SkillInstallResult> {
  const skillName = normalizeSkillName(options.skillName ?? DEFAULT_SKILL_NAME);
  const platform = options.platform ?? "codex";
  const scope = options.scope ?? "project";
  const packageRoot = path.resolve(options.packageRoot);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? getHomeDir());
  const sourceDir = path.resolve(packageRoot, "skills", skillName);
  const targetRoot = resolveSkillTargetRoot({
    platform,
    scope,
    cwd,
    homeDir,
    targetRoot: options.targetRoot
  });
  const targetDir = path.resolve(targetRoot, skillName);

  await assertBundledSkill(sourceDir, skillName);
  assertTargetIsNotSource(sourceDir, targetDir);

  const targetExists = await pathExists(targetDir);
  if (targetExists && !options.force && !options.dryRun) {
    throw new SkillInstallError(`skill target already exists: ${targetDir} (use --force to overwrite)`);
  }

  if (!options.dryRun) {
    await mkdir(targetRoot, { recursive: true });
    if (targetExists) {
      await rm(targetDir, { recursive: true, force: true });
    }
    await cp(sourceDir, targetDir, { recursive: true });
  }

  return {
    skillName,
    platform,
    scope,
    sourceDir,
    targetRoot,
    targetDir,
    installed: !options.dryRun,
    overwritten: targetExists,
    dryRun: options.dryRun ?? false
  };
}

export function resolveSkillTargetRoot(options: {
  platform: SkillInstallPlatform;
  scope: SkillInstallScope;
  cwd: string;
  homeDir: string;
  targetRoot?: string;
}): string {
  if (options.targetRoot) {
    return path.resolve(options.cwd, expandHome(options.targetRoot, options.homeDir));
  }

  if (options.scope === "project") {
    return path.resolve(options.cwd, projectSkillRoot(options.platform));
  }

  return path.resolve(options.homeDir, userSkillRoot(options.platform));
}

export function isSkillInstallPlatform(value: string): value is SkillInstallPlatform {
  return SKILL_INSTALL_PLATFORMS.includes(value as SkillInstallPlatform);
}

export function isSkillInstallScope(value: string): value is SkillInstallScope {
  return SKILL_INSTALL_SCOPES.includes(value as SkillInstallScope);
}

function projectSkillRoot(platform: SkillInstallPlatform): string {
  switch (platform) {
    case "codex":
      return path.join(".agents", "skills");
    case "claude":
      return path.join(".claude", "skills");
    case "cursor":
      return path.join(".cursor", "skills");
    case "vscode":
      return path.join(".github", "skills");
  }
}

function userSkillRoot(platform: SkillInstallPlatform): string {
  switch (platform) {
    case "codex":
      return path.join(".agents", "skills");
    case "claude":
      return path.join(".claude", "skills");
    case "cursor":
      return path.join(".cursor", "skills");
    case "vscode":
      return path.join(".copilot", "skills");
  }
}

function normalizeSkillName(skillName: string): string {
  const normalized = skillName.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new SkillInstallError(`invalid skill name: ${skillName}`);
  }
  return normalized;
}

async function assertBundledSkill(sourceDir: string, skillName: string): Promise<void> {
  const skillFile = path.join(sourceDir, "SKILL.md");
  if (!(await pathExists(skillFile))) {
    throw new SkillInstallError(`bundled skill not found: ${skillName}`);
  }
}

function assertTargetIsNotSource(sourceDir: string, targetDir: string): void {
  const normalizedSource = path.resolve(sourceDir);
  const normalizedTarget = path.resolve(targetDir);
  if (samePath(normalizedSource, normalizedTarget) || isInsidePath(normalizedTarget, normalizedSource)) {
    throw new SkillInstallError("target directory must not be the bundled source skill directory");
  }
}

function expandHome(value: string, homeDir: string): string {
  if (value === "~") {
    return homeDir;
  }

  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(homeDir, value.slice(2));
  }

  return value;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function getHomeDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new SkillInstallError("Unable to resolve the user home directory");
  }
  return homeDir;
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function isInsidePath(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}
