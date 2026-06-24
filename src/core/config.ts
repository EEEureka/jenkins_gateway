import { z } from "zod";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface JenkinsGatewayConfig {
  profile: string;
  baseUrl: URL;
  userId: string;
  apiToken: string;
  enableProtectedTools: boolean;
  protectedAllowAll: boolean;
  protectedViewAllowlist: string[];
  protectedViewDenylist: string[];
  protectedJobAllowlist: string[];
  protectedJobDenylist: string[];
  requestTimeoutMs: number;
  consoleLogMaxBytes: number;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const envSchema = z.object({
  JENKINS_MCP_PROFILE: z.string().trim().optional(),
  JENKINS_BASE_URL: z.string().trim().min(1, "JENKINS_BASE_URL is required"),
  JENKINS_USER_ID: z.string().trim().min(1, "JENKINS_USER_ID is required"),
  JENKINS_API_TOKEN: z.string().trim().min(1, "JENKINS_API_TOKEN is required"),
  JENKINS_MCP_ENABLE_PROTECTED_TOOLS: z.string().trim().optional(),
  JENKINS_MCP_PROTECTED_ALLOW_ALL: z.string().trim().optional(),
  JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST: z.string().trim().optional(),
  JENKINS_MCP_PROTECTED_VIEW_DENYLIST: z.string().trim().optional(),
  JENKINS_MCP_PROTECTED_JOB_ALLOWLIST: z.string().trim().optional(),
  JENKINS_MCP_PROTECTED_JOB_DENYLIST: z.string().trim().optional(),
  JENKINS_MCP_REQUEST_TIMEOUT_MS: z.string().trim().optional(),
  JENKINS_MCP_CONSOLE_LOG_MAX_BYTES: z.string().trim().optional(),
  JENKINS_MCP_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional()
});

export function loadConfig(source: NodeJS.ProcessEnv = process.env): JenkinsGatewayConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new ConfigError(message);
  }

  const env = parsed.data;

  return {
    profile: env.JENKINS_MCP_PROFILE || "default",
    baseUrl: normalizeBaseUrl(env.JENKINS_BASE_URL),
    userId: env.JENKINS_USER_ID,
    apiToken: env.JENKINS_API_TOKEN,
    enableProtectedTools: parseBoolean(env.JENKINS_MCP_ENABLE_PROTECTED_TOOLS, false),
    protectedAllowAll: parseBoolean(env.JENKINS_MCP_PROTECTED_ALLOW_ALL, false),
    protectedViewAllowlist: parseList(env.JENKINS_MCP_PROTECTED_VIEW_ALLOWLIST),
    protectedViewDenylist: parseList(env.JENKINS_MCP_PROTECTED_VIEW_DENYLIST),
    protectedJobAllowlist: parseList(env.JENKINS_MCP_PROTECTED_JOB_ALLOWLIST),
    protectedJobDenylist: parseList(env.JENKINS_MCP_PROTECTED_JOB_DENYLIST),
    requestTimeoutMs: parsePositiveInteger(env.JENKINS_MCP_REQUEST_TIMEOUT_MS, 30_000, "JENKINS_MCP_REQUEST_TIMEOUT_MS"),
    consoleLogMaxBytes: parsePositiveInteger(
      env.JENKINS_MCP_CONSOLE_LOG_MAX_BYTES,
      65_536,
      "JENKINS_MCP_CONSOLE_LOG_MAX_BYTES"
    ),
    logLevel: env.JENKINS_MCP_LOG_LEVEL ?? "info"
  };
}

export function normalizeBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError("JENKINS_BASE_URL must be a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError("JENKINS_BASE_URL must use http or https");
  }

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url;
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }

  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }

  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }

  throw new ConfigError(`Invalid boolean value: ${value}`);
}

export function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${name} must be a positive integer`);
  }

  return parsed;
}
