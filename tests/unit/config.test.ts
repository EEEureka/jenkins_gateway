import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig, normalizeBaseUrl, parseBoolean, parseList } from "../../src/config.js";

describe("loadConfig", () => {
  it("loads required Jenkins settings and defaults", () => {
    const config = loadConfig({
      JENKINS_BASE_URL: "https://jenkins.example.com/root",
      JENKINS_USER_ID: "alice",
      JENKINS_API_TOKEN: "secret"
    });

    expect(config.baseUrl.toString()).toBe("https://jenkins.example.com/root/");
    expect(config.profile).toBe("default");
    expect(config.userId).toBe("alice");
    expect(config.enableProtectedTools).toBe(false);
    expect(config.protectedAllowAll).toBe(false);
    expect(config.protectedJobAllowlist).toEqual([]);
    expect(config.consoleLogMaxBytes).toBe(65_536);
    expect(config.requestTimeoutMs).toBe(30_000);
  });

  it("rejects missing required settings", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow("JENKINS_BASE_URL is required; JENKINS_USER_ID is required; JENKINS_API_TOKEN is required");
  });
});

describe("normalizeBaseUrl", () => {
  it("requires http or https URLs", () => {
    expect(() => normalizeBaseUrl("file:///tmp/jenkins")).toThrow(ConfigError);
  });
});

describe("parseBoolean", () => {
  it("parses common boolean strings", () => {
    expect(parseBoolean("true", false)).toBe(true);
    expect(parseBoolean("0", true)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });
});

describe("parseList", () => {
  it("splits comma-separated values and trims blanks", () => {
    expect(parseList("a, b,, c ")).toEqual(["a", "b", "c"]);
  });
});
