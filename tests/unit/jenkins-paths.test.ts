import { describe, expect, it } from "vitest";

import { buildPath, isJobAllowed, jobPathToUrlPath, normalizeJobPath } from "../../src/jenkins/paths.js";

describe("jobPathToUrlPath", () => {
  it("encodes single jobs", () => {
    expect(jobPathToUrlPath("deploy")).toBe("job/deploy");
  });

  it("encodes folder jobs segment by segment", () => {
    expect(jobPathToUrlPath("folder a/子目录/build/app")).toBe(
      "job/folder%20a/job/%E5%AD%90%E7%9B%AE%E5%BD%95/job/build/job/app"
    );
  });

  it("rejects empty paths", () => {
    expect(() => jobPathToUrlPath(" / ")).toThrow("jobPath");
  });
});

describe("buildPath", () => {
  it("appends numeric build references", () => {
    expect(buildPath("folder/job", 12)).toBe("job/folder/job/job/12");
  });

  it("appends string build references", () => {
    expect(buildPath("folder/job", "lastBuild")).toBe("job/folder/job/job/lastBuild");
  });
});

describe("normalizeJobPath", () => {
  it("normalizes extra slashes and spaces", () => {
    expect(normalizeJobPath(" folder / job ")).toBe("folder/job");
  });
});

describe("isJobAllowed", () => {
  it("requires an explicit allowlist match", () => {
    expect(isJobAllowed("folder/job", [])).toBe(false);
    expect(isJobAllowed("folder/job", ["folder/job"])).toBe(true);
    expect(isJobAllowed("folder/job", ["other/job"])).toBe(false);
  });
});
