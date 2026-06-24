import { ConfigError } from "../config.js";

export function jobPathToUrlPath(jobPath: string): string {
  const segments = splitJobPath(jobPath);
  if (segments.length === 0) {
    throw new ConfigError("jobPath must contain at least one non-empty segment");
  }

  return segments.map((segment) => `job/${encodeURIComponent(segment)}`).join("/");
}

export function normalizeJobPath(jobPath: string): string {
  const segments = splitJobPath(jobPath);
  if (segments.length === 0) {
    throw new ConfigError("jobPath must contain at least one non-empty segment");
  }

  return segments.join("/");
}

export function isJobAllowed(jobPath: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return false;
  }

  const normalizedJobPath = normalizeJobPath(jobPath);
  return allowlist.some((entry) => normalizeJobPath(entry) === normalizedJobPath);
}

export function buildPath(jobPath: string, build: number | string): string {
  const buildRef = typeof build === "number" ? String(build) : build.trim();
  if (!buildRef) {
    throw new ConfigError("build must be a non-empty number or Jenkins build reference");
  }

  return `${jobPathToUrlPath(jobPath)}/${encodeURIComponent(buildRef)}`;
}

function splitJobPath(jobPath: string): string[] {
  return jobPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}
