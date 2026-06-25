import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  installBundledSkill,
  resolveSkillTargetRoot,
  SkillInstallError
} from "../../src/core/skill-installer.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
});

describe("resolveSkillTargetRoot", () => {
  it("uses Codex .agents skill locations", () => {
    expect(
      resolveSkillTargetRoot({
        platform: "codex",
        scope: "project",
        cwd: path.resolve("workspace"),
        homeDir: path.resolve("home")
      })
    ).toBe(path.resolve("workspace", ".agents", "skills"));

    expect(
      resolveSkillTargetRoot({
        platform: "codex",
        scope: "user",
        cwd: path.resolve("workspace"),
        homeDir: path.resolve("home")
      })
    ).toBe(path.resolve("home", ".agents", "skills"));
  });

  it("lets an explicit target root override platform defaults", () => {
    expect(
      resolveSkillTargetRoot({
        platform: "claude",
        scope: "project",
        cwd: path.resolve("workspace"),
        homeDir: path.resolve("home"),
        targetRoot: "~/.agents/skills"
      })
    ).toBe(path.resolve("home", ".agents", "skills"));
  });
});

describe("installBundledSkill", () => {
  it("copies the bundled skill into the target skill root", async () => {
    const packageRoot = await createPackageRoot();
    const workspaceRoot = await createTempRoot();

    const result = await installBundledSkill({
      packageRoot,
      skillName: "jenkins-workflow",
      platform: "codex",
      scope: "project",
      cwd: workspaceRoot,
      homeDir: path.join(workspaceRoot, "home")
    });

    expect(result).toMatchObject({
      skillName: "jenkins-workflow",
      platform: "codex",
      scope: "project",
      installed: true,
      overwritten: false,
      dryRun: false
    });
    await expect(readFile(path.join(workspaceRoot, ".agents", "skills", "jenkins-workflow", "SKILL.md"), "utf8")).resolves.toContain(
      "name: jenkins-workflow"
    );
    await expect(
      readFile(path.join(workspaceRoot, ".agents", "skills", "jenkins-workflow", "references", "workflows.md"), "utf8")
    ).resolves.toContain("workflow notes");
  });

  it("refuses to overwrite an existing skill unless force is enabled", async () => {
    const packageRoot = await createPackageRoot();
    const workspaceRoot = await createTempRoot();

    await installBundledSkill({
      packageRoot,
      skillName: "jenkins-workflow",
      cwd: workspaceRoot,
      homeDir: path.join(workspaceRoot, "home")
    });

    await expect(
      installBundledSkill({
        packageRoot,
        skillName: "jenkins-workflow",
        cwd: workspaceRoot,
        homeDir: path.join(workspaceRoot, "home")
      })
    ).rejects.toThrow(SkillInstallError);

    await expect(
      installBundledSkill({
        packageRoot,
        skillName: "jenkins-workflow",
        cwd: workspaceRoot,
        homeDir: path.join(workspaceRoot, "home"),
        force: true
      })
    ).resolves.toMatchObject({
      overwritten: true
    });
  });

  it("does not write files in dry-run mode", async () => {
    const packageRoot = await createPackageRoot();
    const workspaceRoot = await createTempRoot();

    const result = await installBundledSkill({
      packageRoot,
      skillName: "jenkins-workflow",
      cwd: workspaceRoot,
      homeDir: path.join(workspaceRoot, "home"),
      dryRun: true
    });

    expect(result).toMatchObject({
      installed: false,
      dryRun: true
    });
    await expect(readFile(path.join(workspaceRoot, ".agents", "skills", "jenkins-workflow", "SKILL.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});

async function createPackageRoot(): Promise<string> {
  const packageRoot = await createTempRoot();
  const skillRoot = path.join(packageRoot, "skills", "jenkins-workflow");
  await mkdir(path.join(skillRoot, "references"), { recursive: true });
  await writeFile(path.join(skillRoot, "SKILL.md"), "---\nname: jenkins-workflow\n---\n", "utf8");
  await writeFile(path.join(skillRoot, "references", "workflows.md"), "workflow notes\n", "utf8");
  return packageRoot;
}

async function createTempRoot(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "jenkins-gateway-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
